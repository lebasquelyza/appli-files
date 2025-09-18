// apps/web/app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";

/* ============ Types ============ */
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

/* ============ Helpers ============ */
function jsonError(status: number, msg: string, extraHeaders: Record<string, string> = {}) {
  return new NextResponse(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

/* pacing / verrous mémoire (fallback local) */
let lastCall = 0;
// ⬇️ lissage plus strict pour éviter les 429 OpenAI
const MIN_SPACING_MS = 2500;
async function pace() {
  const now = Date.now();
  const wait = Math.max(0, lastCall + MIN_SPACING_MS - now);
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

let inFlight = 0;
async function withMemLock<T>(fn: () => Promise<T>) {
  while (inFlight >= 1) await new Promise((r) => setTimeout(r, 50));
  inFlight++;
  try { return await fn(); } finally { inFlight--; }
}

const lastByIp = new Map<string, number>();
const lastOrg = { t: 0, count: 0 };
const SOFT_COOLDOWN_IP_MS = 60_000; // 1 req / 60s IP (fallback mémoire)
const SOFT_WINDOW_ORG_MS = 60_000;  // 1 min
const SOFT_ORG_LIMIT = 3;           // 3/min org (fallback)

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

/* ============ Upstash REST (POST JSON = tableau brut) ============ */
/** URL: UPSTASH_REDIS_REST_URL (https://...upstash.io)
 *  TOKEN: UPSTASH_REDIS_REST_TOKEN
 */
function upstashAvailable() {
  return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
}

/** Envoie une commande Redis à Upstash via POST avec body JSON = ["CMD","arg1",...]. */
async function upstashCommand<T = any>(...args: (string | number)[]) {
  const base = process.env.UPSTASH_REDIS_REST_URL!;
  try {
    const res = await fetch(base, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(args.map(String)), // ⚠️ tableau brut
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Upstash HTTP ${res.status}: ${txt}`);
    }
    return res.json() as Promise<{ result: T }>;
  } catch (e: any) {
    console.error("[upstash] command failed:", e?.message || e);
    throw e;
  }
}

// Wrappers
async function redisSetNXPX(key: string, value: string, ttlMs: number): Promise<boolean> {
  // SET key value PX <ms> NX
  const { result } = await upstashCommand<string>("SET", key, value, "PX", ttlMs, "NX");
  return result === "OK";
}
async function redisGet(key: string): Promise<string | null> {
  const { result } = await upstashCommand<string | null>("GET", key);
  return result ?? null;
}
async function redisDel(key: string): Promise<number> {
  const { result } = await upstashCommand<number>("DEL", key);
  return Number(result || 0);
}
async function redisIncr(key: string): Promise<number> {
  const { result } = await upstashCommand<number>("INCR", key);
  return Number(result || 0);
}
async function redisExpire(key: string, seconds: number): Promise<number> {
  const { result } = await upstashCommand<number>("EXPIRE", key, seconds);
  return Number(result || 0);
}
async function redisPTTL(key: string): Promise<number> {
  const { result } = await upstashCommand<number>("PTTL", key);
  return typeof result === "number" ? result : -2;
}

/** Limiteur fenêtre fixe via INCR/EXPIRE. */
async function fixedWindowLimit(key: string, limit: number, windowSec: number) {
  const count = await redisIncr(key);
  if (count === 1) await redisExpire(key, windowSec);
  let pttl = await redisPTTL(key);
  if (pttl < 0) pttl = windowSec * 1000;
  return { success: count <= limit, reset: Date.now() + pttl };
}

/** Lock distribué via SET NX PX. */
async function withRedisLock<T>(key: string, ttlMs: number, timeoutMs: number, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  while (true) {
    const ok = await redisSetNXPX(key, "1", ttlMs);
    if (ok) break;
    if (Date.now() - start > timeoutMs) {
      const err: any = new Error("queue_timeout");
      err.status = 429; err.retryAfter = "10";
      throw err;
    }
    await new Promise(r => setTimeout(r, 150 + Math.floor(Math.random() * 100)));
  }
  try { return await fn(); } finally { await redisDel(key).catch(()=>{}); }
}

/* ============ GET /api/analyze (diagnostic) ============ */
export async function GET() {
  let imported = false, redisOk = false;
  let error: string | null = null;
  const env = upstashAvailable();
  if (env) {
    try {
      await redisSetNXPX("diag:ping", "1", 3000);
      const v = await redisGet("diag:ping");
      redisOk = v !== null;
      imported = true; // “REST utilisable”
    } catch (e: any) {
      error = e?.message || String(e);
      imported = false; redisOk = false;
    }
  }
  const hasOpenAI = !!(process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY);
  return NextResponse.json({
    upstash: { env, imported, redisOk, error },
    openaiKey: hasOpenAI,
    pacingMs: MIN_SPACING_MS,
    ipCooldownFallbackMs: SOFT_COOLDOWN_IP_MS,
  });
}

/* ============ POST /api/analyze ============ */
export async function POST(req: NextRequest) {
  try {
    console.log("[analyze] env",
      "UPSTASH_ENV:", upstashAvailable(),
      "OPENAI_KEY:", !!(process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY)
    );

    const ctype = (req.headers.get("content-type") || "").toLowerCase();
    if (!ctype.includes("application/json")) {
      return jsonError(415, "Envoie JSON { frames: base64[], timestamps: number[], feeling?: string, fileUrl?: string, economyMode?: boolean }");
    }

    const body = await req.json();
    let frames: string[] = Array.isArray(body.frames) ? body.frames : [];
    let timestamps: number[] = Array.isArray(body.timestamps) ? body.timestamps : [];
    const feeling: string = typeof body.feeling === "string" ? body.feeling : "";
    const fileUrl: string | undefined = typeof body.fileUrl === "string" ? body.fileUrl : undefined;
    const economyMode: boolean = body.economyMode !== false;

    if (!frames.length) return jsonError(400, "Aucune frame fournie.");

    const apiKey = process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY || "";
    if (!apiKey) return jsonError(500, "Clé OpenAI manquante (OPEN_API_KEY ou OPENAI_API_KEY).");

    // Cap: 1 image (mosaïque côté front)
    if (frames.length > 1) {
      frames = frames.slice(0, 1);
      timestamps = timestamps.slice(0, 1);
    }

    // ---- Rate-limit IP + ORG (Upstash si dispo, sinon fallback mémoire)
    const ip = clientIp(req);

    if (upstashAvailable()) {
      // nouveau: IP 1/60s, ORG 3/min
      const ipRes  = await fixedWindowLimit(`analyze:ip:${ip}`, 1, 60);
      if (!ipRes.success) {
        const retry = Math.max(1, Math.ceil((ipRes.reset - Date.now()) / 1000));
        return jsonError(429, "rate_limit_per_ip", { "retry-after": String(retry) });
      }
      const orgRes = await fixedWindowLimit(`analyze:org:global`, 3, 60);
      if (!orgRes.success) {
        const retry = Math.max(1, Math.ceil((orgRes.reset - Date.now()) / 1000));
        return jsonError(429, "rate_limit_org", { "retry-after": String(retry) });
      }
    } else {
      // Fallback mémoire
      const now = Date.now();
      const last = lastByIp.get(ip) || 0;
      if (now - last < SOFT_COOLDOWN_IP_MS) {
        const retry = Math.ceil((SOFT_COOLDOWN_IP_MS - (now - last)) / 1000);
        return jsonError(429, "rate_limit_per_ip", { "retry-after": String(retry) });
      }
      lastByIp.set(ip, now);
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

    // Prompt compact
    const instruction =
      'Analyse d’une image mosaïque issue d’une vidéo de musculation. ' +
      'Réponds STRICTEMENT en JSON: {"exercise":string,"confidence":number,"overall":string,"muscles":string[],"cues":string[],"extras":string[],"timeline":[{"time":number,"label":string,"detail"?:string}]}. ' +
      'Limite à 3 muscles, 3 cues max, timeline 2 points pertinents.';

    const userParts: any[] = [{ type: "input_text", text: instruction }];
    if (feeling) userParts.push({ type: "input_text", text: `Ressenti: ${feeling}` });
    if (fileUrl) userParts.push({ type: "input_text", text: `URL vidéo: ${fileUrl}` });
    userParts.push({ type: "input_image", image_url: frames[0] });
    if (typeof timestamps[0] === "number") userParts.push({ type: "input_text", text: `repere=${Math.round(timestamps[0])}s` });

    const maxOut = 100;

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
          text: { format: { type: "json_object" } }, // JSON strict (Responses API)
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        const retryAfter = resp.headers.get("retry-after") || "";
        console.error("[analyze] oai_error", {
          status: resp.status,
          retryAfter,
          rlReqLimit: resp.headers.get("x-ratelimit-limit-requests"),
          rlReqRemain: resp.headers.get("x-ratelimit-remaining-requests"),
          rlTokLimit: resp.headers.get("x-ratelimit-limit-tokens"),
          rlTokRemain: resp.headers.get("x-ratelimit-remaining-tokens"),
        });
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

    // ⬇️ retry 2× sur 429 (Retry-After ou backoff+jitter)
    async function callWithRetry() {
      let attempt = 0;
      while (true) {
        try {
          return await callOpenAI();
        } catch (e: any) {
          const status = e?.status ?? e?.response?.status;
          const is429 = status === 429 || e?.code === "rate_limit_exceeded" || /rate[_\s-]?limit/i.test(String(e?.message||""));
          if (!is429 || attempt >= 2) throw e;

          const raSec = Number.parseInt(e?.retryAfter || "", 10);
          const waitMs = Number.isFinite(raSec) && raSec > 0
            ? raSec * 1000
            : (4000 + Math.floor(Math.random() * 4000)) * (attempt + 1);
          await new Promise(r => setTimeout(r, waitMs));
          attempt++;
        }
      }
    }

    // ---- Lock distribué (Upstash) ou lock mémoire
    let json: any;
    if (upstashAvailable()) {
      const lockKey = "oai:gpt4o-mini:lock";
      const ttlMs = 8000;
      const timeout = 15_000;
      console.log("[analyze] lock:start", new Date().toISOString());
      json = await withRedisLock(lockKey, ttlMs, timeout, async () => {
        console.log("[analyze] lock:acquired");
        return await callWithRetry();
      });
    } else {
      json = await withMemLock(callWithRetry);
    }

    const text: string =
      json?.output_text || json?.content?.[0]?.text || json?.choices?.[0]?.message?.content || "";

    if (!text) return jsonError(502, "Réponse vide du modèle.");

    let parsed: AIAnalysis | null = null;
    try { parsed = JSON.parse(text); }
    catch { const m = text.match(/\{[\s\S]*\}$/); if (m) parsed = JSON.parse(m[0]); }
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
      const retryAfter = e?.retryAfter || "30";
      return jsonError(429, "rate_limit_exceeded", { "retry-after": retryAfter });
    }
    if (status === 400 && /Unsupported parameter:\s*'response_format'/i.test(msg)) {
      return jsonError(400, "Config invalide: utiliser text.format (Responses API) au lieu de response_format.");
    }
    if (Number.isInteger(status)) return jsonError(status, msg);
    return jsonError(500, msg);
  }
}
