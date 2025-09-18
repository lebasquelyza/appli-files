// apps/web/app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";

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

/* -------------------- Pacing doux (toujours actif) -------------------- */
let lastCall = 0;
const MIN_SPACING_MS = 1000;
async function pace() {
  const now = Date.now();
  const wait = Math.max(0, lastCall + MIN_SPACING_MS - now);
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

/* -------------------- Fallback mémoire (si pas d'Upstash) -------------------- */
let inFlight = 0; // lock mémoire (mono-instance)
async function withMemLock<T>(fn: () => Promise<T>) {
  while (inFlight >= 1) await new Promise((r) => setTimeout(r, 50));
  inFlight++;
  try { return await fn(); } finally { inFlight--; }
}
const lastByIp = new Map<string, number>();
const lastOrg = { t: 0, count: 0 };
const SOFT_COOLDOWN_IP_MS = 20_000;
const SOFT_WINDOW_ORG_MS = 60_000;
const SOFT_ORG_LIMIT = 20;

/* -------------------- Import paresseux Upstash -------------------- */
// évite l’erreur “module not found” au build si les deps ne sont pas installées
type UpstashLibs = { Redis: any; Ratelimit: any };
async function getUpstash(): Promise<UpstashLibs | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    // @ts-ignore
    const { Redis } = await import("@upstash/redis");
    // @ts-ignore
    const { Ratelimit } = await import("@upstash/ratelimit");
    return { Redis, Ratelimit };
  } catch {
    return null; // packages non présents → fallback mémoire
  }
}

function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

/* -------------------- Cache anti double-clic -------------------- */
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

    // ✅ 1 seule image (mosaïque côté front)
    const cap = 1;
    if (frames.length > cap) {
      frames = frames.slice(0, cap);
      timestamps = timestamps.slice(0, cap);
    }

    // ---- Upstash (si dispo) : rate-limit + lock distribué
    const upstash = await getUpstash();
    let ipLimiter: any = null, orgLimiter: any = null, redis: any = null;
    if (upstash) {
      const { Redis, Ratelimit } = upstash;
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
      ipLimiter = new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(1, "20 s"), prefix: "analyze:ip" });
      orgLimiter = new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(20, "60 s"), prefix: "analyze:org" });
    }

    // ---- Rate-limit par IP
    const ip = clientIp(req);
    if (ipLimiter) {
      const ipRes = await ipLimiter.limit(ip);
      if (!ipRes.success) {
        const retry = Math.max(1, Math.ceil((ipRes.reset - Date.now()) / 1000));
        return jsonError(429, "rate_limit_per_ip", { "retry-after": String(retry) });
      }
    } else {
      // fallback mémoire (moins fiable en serverless multi-instances)
      const now = Date.now();
      const last = lastByIp.get(ip) || 0;
      if (now - last < SOFT_COOLDOWN_IP_MS) {
        const retry = Math.ceil((SOFT_COOLDOWN_IP_MS - (now - last)) / 1000);
        return jsonError(429, "rate_limit_per_ip", { "retry-after": String(retry) });
      }
      lastByIp.set(ip, now);
    }

    // ---- Rate-limit org-wide
    if (orgLimiter) {
      const orgRes = await orgLimiter.limit("global");
      if (!orgRes.success) {
        const retry = Math.max(1, Math.ceil((orgRes.reset - Date.now()) / 1000));
        return jsonError(429, "rate_limit_org", { "retry-after": String(retry) });
      }
    } else {
      const now = Date.now();
      if (now - lastOrg.t > SOFT_WINDOW_ORG_MS) { lastOrg.t = now; lastOrg.count = 0; }
      lastOrg.count++;
      if (lastOrg.count > SOFT_ORG_LIMIT) {
        const retry = Math.ceil((lastOrg.t + SOFT_WINDOW_ORG_MS - now) / 1000);
        return jsonError(429, "rate_limit_org", { "retry-after": String(retry) });
      }
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
    if (typeof timestamps[0] === "number") userParts.push({ type: "input_text", text: `repere=${Math.round(timestamps[0])}s` });

    const maxOut = 120; // sortie courte

    // ---- Appel OpenAI sous lock (Upstash si dispo, sinon mémoire)
    const callOpenAI = async () => {
      await pace();
      const resp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
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
    };

    let json: any;
    if (upstash && redis) {
      // lock distribué via Redis (NX + TTL)
      const lockKey = "oai:gpt4o-mini:lock";
      const ttlMs = 5000;
      const start = Date.now();
      const timeout = 10_000;
      while (true) {
        const ok = await redis.set(lockKey, "1", { nx: true, px: ttlMs });
        if (ok) break;
        if (Date.now() - start > timeout) {
          const err: any = new Error("queue_timeout");
          err.status = 429; err.retryAfter = "10";
          throw err;
        }
        await new Promise((r) => setTimeout(r, 150 + Math.floor(Math.random() * 100)));
      }
      try { json = await callOpenAI(); }
      finally { await redis.del(lockKey); }
    } else {
      // fallback mono-instance
      json = await withMemLock(callOpenAI);
    }

    const text: string =
      json?.output_text || json?.content?.[0]?.text || json?.choices?.[0]?.message?.content || "";

    if (!text) return jsonError(502, "Réponse vide du modèle.");

    let parsed: AIAnalysis | null = null;
    try { parsed = JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}$/);
      if (m) parsed = JSON.parse(m[0]);
    }
    if (!parsed) return jsonError(502, "Impossible de parser la réponse JSON.");

    parsed.muscles ||= []; parsed.cues ||= []; parsed.extras ||= []; parsed.timeline ||= [];

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

    if (Number.isInteger(status)) return jsonError(status, msg);
    return jsonError(500, msg);
  }
}
