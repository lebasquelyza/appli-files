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

/* ============ Config Next ============ */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

/* ============ Utils ============ */
function jsonError(status: number, msg: string, extraHeaders: Record<string, string> = {}) {
  return new NextResponse(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json", "Cache-Control": "no-store, no-transform", ...extraHeaders },
  });
}

function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

function hashKey(frames: string[], feeling: string, economyMode: boolean) {
  const s = frames.join("|").slice(0, 2000) + "::" + (feeling || "") + "::" + (economyMode ? "e1" : "e0");
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

// Promise timeout that truly aborts a fetch via provided AbortController.
async function withTimeout<T>(p: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => { try { onTimeout?.(); } catch {} ; reject(new Error("timeout")); }, ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

/* ============ Simple pacing & memory lock (fallback) ============ */
let lastCall = 0;
const MIN_SPACING_MS = 500;
async function pace() {
  const now = Date.now();
  const wait = Math.max(0, lastCall + MIN_SPACING_MS - now);
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}
let inFlight = 0;
async function withMemLock<T>(fn: () => Promise<T>) {
  while (inFlight >= 1) await new Promise((r) => setTimeout(r, 40));
  inFlight++;
  try { return await fn(); } finally { inFlight--; }
}

/* ============ In-memory cache anti double-clic ============ */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { t: number; json: AIAnalysis }>();

/* ============ Upstash REST (optionnel) ============ */
function upstashAvailable() {
  return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
}
/** Envoie une commande Redis à Upstash (body JSON = ["CMD","arg1",...]) */
async function upstashCommand<T = any>(...args: (string | number)[]) {
  const base = process.env.UPSTASH_REDIS_REST_URL!;
  const controller = new AbortController();
  const p = fetch(base, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args.map(String)),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Upstash HTTP ${res.status}: ${txt}`);
    }
    return res.json() as Promise<{ result: T }>;
  });
  // Upstash doit répondre très vite
  return withTimeout(p, 3000, () => controller.abort("upstash_timeout"));
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
async function fixedWindowLimit(key: string, limit: number, windowSec: number) {
  const count = await redisIncr(key);
  if (count === 1) await redisExpire(key, windowSec);
  let pttl = await redisPTTL(key);
  if (pttl < 0) pttl = windowSec * 1000;
  return { success: count <= limit, reset: Date.now() + pttl };
}

/* ============ GET /api/analyze (diagnostic) ============ */
export async function GET() {
  let imported = false, redisOk = false;
  let error: string | null = null;
  const env = upstashAvailable();
  if (env) {
    try {
      await upstashCommand("SET", "diag:ping", "1", "PX", 3000);
      const res = await upstashCommand<string | null>("GET", "diag:ping");
      redisOk = (res?.result ?? null) !== null;
      imported = true;
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
  }, { headers: { "Cache-Control": "no-store, no-transform" } });
}

/* ============ POST /api/analyze — SSE streaming ============ */
/**
 * Client-side example:
 * const es = new EventSource('/api/analyze', { withCredentials: false });
 * es.addEventListener('heartbeat', () => {/* keep-alive *\/});
 * es.addEventListener('result', (e) => { const data = JSON.parse(e.data); ...; es.close(); });
 * es.addEventListener('error', (e) => { console.error(e); es.close(); });
 * fetch('/api/analyze', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({...}) });
 */
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
    const economyMode: boolean = body.economyMode !== false;

    if (!frames.length) return jsonError(400, "Aucune frame fournie.");

    const apiKey = process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY || "";
    if (!apiKey) return jsonError(500, "Clé OpenAI manquante (OPEN_API_KEY ou OPENAI_API_KEY).");

    // Cap: 1 image (mosaïque côté client)
    if (frames.length > 1) {
      frames = frames.slice(0, 1);
      timestamps = timestamps.slice(0, 1);
    }

    // ---- Rate-limit IP + ORG (Upstash si dispo, sinon fallback mémoire)
    const ip = clientIp(req);
    const SOFT_COOLDOWN_IP_MS = 60_000;
    const SOFT_WINDOW_ORG_MS = 60_000;
    const SOFT_ORG_LIMIT = 3;
    const lastByIp = (global as any).__analyze_lastByIp ?? ((global as any).__analyze_lastByIp = new Map<string, number>());
    const lastOrg = (global as any).__analyze_lastOrg ?? ((global as any).__analyze_lastOrg = { t: 0, count: 0 });

    if (upstashAvailable()) {
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

    // ---- Cache
    const key = hashKey(frames, feeling || "", economyMode);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < CACHE_TTL_MS) {
      // Retour JSON normal si déjà en cache (pas besoin de SSE)
      return NextResponse.json(hit.json, { headers: { "Cache-Control": "no-store, no-transform" } });
    }

    // ---- Construire l'instruction
    const instruction =
      'Analyse d’une image mosaïque issue d’une vidéo de musculation. ' +
      'Réponds STRICTEMENT en JSON: {"exercise":string,"confidence":number,"overall":string,"muscles":string[],"cues":string[],"extras":string[],"timeline":[{"time":number,"label":string,"detail"?:string}]}. ' +
      'Limite à 3 muscles, 3 cues max, timeline 2 points pertinents.';

    const userParts: any[] = [{ type: "input_text", text: instruction }];
    if (feeling) userParts.push({ type: "input_text", text: `Ressenti: ${feeling}` });
    if (fileUrl) userParts.push({ type: "input_text", text: `URL vidéo: ${fileUrl}` });
    userParts.push({ type: "input_image", image_url: frames[0] });
    if (typeof timestamps[0] === "number") userParts.push({ type: "input_text", text: `repere=${Math.round(timestamps[0])}s` });

    const model = "gpt-4o-mini";
    const maxOut = 60;

    // ---- SSE Response (keep-alive heartbeats + final result)
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const writeSSE = (event: string, data: any) =>
      writer.write(encoder.encode(`event: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`));
    const writeComment = (comment: string) =>
      writer.write(encoder.encode(`: ${comment}\n\n`)); // comment line (heartbeat)

    // Heartbeat every 1s to keep Netlify/LB connection alive
    const hb = setInterval(() => writeComment("heartbeat"), 1000);

    // Main job in background of this request (but same response stream)
    (async () => {
      try {
        await pace();

        const controller = new AbortController();

        // Appel OpenAI non-streamé (simple) mais avec timeout ample (< Netlify 30s)
        const openAiPromise = fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY}` },
          body: JSON.stringify({
            model,
            input: [{ role: "user", content: userParts }],
            temperature: 0.2,
            max_output_tokens: maxOut,
            text: { format: { type: "json_object" } },
          }),
          signal: controller.signal,
        }).then(async (resp) => {
          if (!resp.ok) {
            const txt = await resp.text().catch(() => "");
            const err: any = new Error(`OpenAI error ${resp.status}: ${txt}`);
            err.status = resp.status;
            err.retryAfter = resp.headers.get("retry-after") || "";
            try { err.code = JSON.parse(txt)?.error?.code; } catch {}
            throw err;
          }
          return resp.json();
        });

        // 20s max pour l'appel modèle (garde marge vs. Netlify)
        const json = await withTimeout(openAiPromise, 20_000, () => controller.abort("openai_timeout"));

        const text: string =
          json?.output_text || json?.content?.[0]?.text || json?.choices?.[0]?.message?.content || "";

        if (!text) throw Object.assign(new Error("Réponse vide du modèle."), { status: 502 });

        // Parsing robuste
        let parsed: AIAnalysis | null = null;
        try { parsed = JSON.parse(text); }
        catch {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) { try { parsed = JSON.parse(m[0]); } catch {}
          }
        }
        if (!parsed || typeof parsed !== "object") {
          throw Object.assign(new Error("Impossible de parser la réponse JSON."), { status: 502 });
        }
        parsed.muscles ||= []; parsed.cues ||= []; parsed.extras ||= []; parsed.timeline ||= [];

        // Cache
        cache.set(key, { t: Date.now(), json: parsed });

        // Send final result event
        await writeSSE("result", parsed);
      } catch (e: any) {
        const status = e?.status ?? e?.response?.status;
        if (status === 429) {
          await writeSSE("error", { code: "rate_limit_exceeded", retryAfter: e?.retryAfter || "20" });
        } else if (status === 504 || /timeout|gateway_timeout/i.test(String(e?.message || e))) {
          await writeSSE("error", { code: "gateway_timeout", retryAfter: "12" });
        } else {
          await writeSSE("error", { code: "internal_error", message: String(e?.message || e) });
        }
      } finally {
        clearInterval(hb);
        try { await writer.close(); } catch {}
      }
    })();

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no" // helpful on some proxies
      },
    });

  } catch (e: any) {
    const status = e?.status ?? e?.response?.status;
    const msg = e?.message || "Erreur interne";
    if (Number.isInteger(status)) return jsonError(status, msg);
    return jsonError(500, msg);
  }
}
