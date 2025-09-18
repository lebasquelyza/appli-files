// apps/web/app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type AnalysisPoint = { time: number; label: string; detail?: string };
type AIAnalysis = {
  exercise: string;
  confidence: number;
  overall: string;
  muscles: string[];
  cues: string[];
  extras?: string[];
  timeline: AnalysisPoint[];
};

function jsonError(status: number, msg: string, extraHeaders: Record<string, string> = {}) {
  return new NextResponse(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

/* -------------------- Upstash Redis -------------------- */
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// 1) Rate-limit par IP: 1 requête / 20s
const ipLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(1, "20 s"),
  prefix: "analyze:ip",
});

// 2) Rate-limit org-wide: 20 requêtes / minute (ajuste selon ton quota)
const orgLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(20, "60 s"),
  prefix: "analyze:org",
});

/* -------------------- Lock distribué (global) -------------------- */
// Empêche plusieurs lambdas de frapper OAI en même temps
async function withRedisLock<T>(key: string, ttlMs: number, fn: () => Promise<T>) {
  const start = Date.now();
  const timeout = 10_000; // patience max 10s pour prendre le lock
  while (true) {
    const ok = await redis.set(key, "1", { nx: true, px: ttlMs });
    if (ok) break;
    if (Date.now() - start > timeout) {
      throw Object.assign(new Error("queue_timeout"), { status: 429, retryAfter: "10" });
    }
    // petit backoff
    await new Promise((r) => setTimeout(r, 150 + Math.floor(Math.random() * 100)));
  }

  try {
    return await fn();
  } finally {
    await redis.del(key);
  }
}

/* -------------------- Pacing doux -------------------- */
let lastCall = 0;
const MIN_SPACING_MS = 1000; // espace mini entre appels sortants
async function pace() {
  const now = Date.now();
  const wait = Math.max(0, lastCall + MIN_SPACING_MS - now);
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

/* -------------------- Utils -------------------- */
function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { t: number; json: AIAnalysis }>();
function hashKey(frames: string[], feeling: string, economyMode: boolean) {
  const s = frames.join("|").slice(0, 2000) + "::" + (feeling || "") + "::" + (economyMode ? "e1" : "e0");
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

export async function POST(req: NextRequest) {
  try {
    const ctype = (req.headers.get("content-type") || "").toLowerCase();
    if (!ctype.includes("application/json")) {
      return jsonError(415, "Envoie JSON { frames: base64[], timestamps: number[], feeling?: string, fileUrl?: string, economyMode?: boolean }");
    }

    const body = await req.json();
    let frames: string[] = Array.isArray(body.frames) ? body.frames : [];
    let timestamps: number[] = Array.isArray(body.timestamps) ? body.timestamps : [];
    const feeling: string = typeof body.feeling === "string" ? body.feeling : "";
    const fileUrl: string | undefined = typeof body.fileUrl === "string" ? body.fileUrl : undefined;
    const economyMode: boolean = body.economyMode !== false; // éco par défaut

    if (!frames.length) return jsonError(400, "Aucune frame fournie.");

    const apiKey = process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY || "";
    if (!apiKey) return jsonError(500, "Clé OpenAI manquante (OPEN_API_KEY ou OPENAI_API_KEY).");

    // ✅ On n'autorise qu'UNE image (mosaïque côté front)
    const cap = 1;
    if (frames.length > cap) {
      frames = frames.slice(0, cap);
      timestamps = timestamps.slice(0, cap);
    }

    // ---- Rate-limit par IP
    const ip = clientIp(req);
    const ipRes = await ipLimiter.limit(ip || "unknown");
    if (!ipRes.success) {
      const retry = Math.max(1, Math.ceil((ipRes.reset - Date.now()) / 1000));
      return jsonError(429, "rate_limit_per_ip", { "retry-after": String(retry) });
    }

    // ---- Rate-limit org-wide
    const orgKey = "global";
    const orgRes = await orgLimiter.limit(orgKey);
    if (!orgRes.success) {
      const retry = Math.max(1, Math.ceil((orgRes.reset - Date.now()) / 1000));
      return jsonError(429, "rate_limit_org", { "retry-after": String(retry) });
    }

    // ---- Cache anti double-clic
    const key = hashKey(frames, feeling || "", economyMode);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.t < CACHE_TTL_MS) {
      return NextResponse.json(cached.json);
    }

    // Prompt compact (éco)
    const instruction =
      'Analyse d’une image mosaïque issue d’une vidéo de musculation. ' +
      'Réponds STRICTEMENT en JSON: {"exercise":string,"confidence":number,"overall":string,"muscles":string[],"cues":string[],"extras":string[],"timeline":[{"time":number,"label":string,"detail"?:string}]}. ' +
      'Limite à 3 muscles, 3 cues max, timeline 2 points pertinents.';

    const userParts: any[] = [{ type: "input_text", text: instruction }];
    if (feeling) userParts.push({ type: "input_text", text: `Ressenti: ${feeling}` });
    if (fileUrl) userParts.push({ type: "input_text", text: `URL vidéo: ${fileUrl}` });
    userParts.push({ type: "input_image", image_url: frames[0] });
    if (typeof timestamps[0] === "number") {
      userParts.push({ type: "input_text", text: `repere=${Math.round(timestamps[0])}s` });
    }

    const maxOut = 120; // sortie très courte

    // ---- Appel OpenAI sous lock distribué
    const json = await withRedisLock("oai:gpt4o-mini:lock", 5000, async () => {
      await pace();
      const resp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          input: [{ role: "user", content: userParts }],
          temperature: 0.2,
          max_output_tokens: maxOut,
          text: { format: { type: "json_object" } }, // JSON strict
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        const retryAfter = resp.headers.get("retry-after") || "";
        const err: any = new Error(`OpenAI error ${resp.status}: ${txt}`);
        err.status = resp.status;
        err.retryAfter = retryAfter;
        try {
          const parsed = JSON.parse(txt);
          err.code = parsed?.error?.code;
          err.message = parsed?.error?.message || err.message;
        } catch {}
        throw err;
      }
      return resp.json();
    });

    const text: string =
      json?.output_text ||
      json?.content?.[0]?.text ||
      json?.choices?.[0]?.message?.content ||
      "";

    if (!text) return jsonError(502, "Réponse vide du modèle.");

    let parsed: AIAnalysis | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}$/);
      if (m) parsed = JSON.parse(m[0]);
    }
    if (!parsed) return jsonError(502, "Impossible de parser la réponse JSON.");

    parsed.muscles ||= [];
    parsed.cues ||= [];
    parsed.extras ||= [];
    parsed.timeline ||= [];

    cache.set(key, { t: Date.now(), json: parsed });
    return NextResponse.json(parsed);
  } catch (e: any) {
    console.error("/api/analyze error:", e);

    const status = e?.status ?? e?.response?.status;
    const msg = e?.message || "Erreur interne";

    const is429 =
      status === 429 ||
      e?.code === "rate_limit_exceeded" ||
      /rate[_\s-]?limit/i.test(String(msg)) ||
      msg === "queue_timeout";

    if (is429) {
      const retryAfter = e?.retryAfter || "20";
      return jsonError(429, "rate_limit_exceeded", { "retry-after": retryAfter });
    }

    if (status === 400 && /Unsupported parameter:\s*'response_format'/i.test(msg)) {
      return jsonError(400, "Config invalide: utiliser text.format (Responses API) au lieu de response_format.");
    }

    if (Number.isInteger(status)) {
      return jsonError(status, msg);
    }

    return jsonError(500, msg);
  }
}
