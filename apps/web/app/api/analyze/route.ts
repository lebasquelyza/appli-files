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

/* ============ Utils génériques ============ */
function jsonError(status: number, msg: string, extraHeaders: Record<string, string> = {}) {
  return new NextResponse(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json", "Cache-Control": "no-store, no-transform", ...extraHeaders },
  });
}

/** Détection IP fiable sur Netlify + fallbacks */
function clientIp(req: NextRequest) {
  const nf = req.headers.get("x-nf-client-connection-ip");
  if (nf) return nf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const ip = xff.split(",")[0]?.trim();
    if (ip) return ip;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function hashKey(frames: string[], feeling: string, economyMode: boolean) {
  const s = frames.join("|").slice(0, 2000) + "::" + (feeling || "") + "::" + (economyMode ? "e1" : "e0");
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

// Promise timeout qui peut abort via callback
async function withTimeout<T>(p: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => { try { onTimeout?.(); } catch {} ; reject(new Error("timeout")); }, ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

/* ============ Normalisation/validation d’image ============ */
type SanitizeOk = { ok: true; kind: "https" | "data"; url: string; mime?: string; b64?: string };
type SanitizeErr = { ok: false; reason: "empty" | "blob_url" | "bad_base64" | "unsupported" };
type SanitizeResult = SanitizeOk | SanitizeErr;

// Vérifie et normalise en URL http(s) OU data URL base64 stricte.
// Si data URL, retourne aussi { mime, b64 } pour upload.
function sanitizeImageInput(raw: string): SanitizeResult {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  // Interdit blob: (URL locale navigateur)
  if (/^blob:/i.test(trimmed)) return { ok: false, reason: "blob_url" };

  // http(s) publique
  if (/^https?:\/\//i.test(trimmed)) return { ok: true, kind: "https", url: trimmed };

  // Data URL stricte
  const m = /^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=\s]+)$/i.exec(trimmed);
  if (m) {
    const mime = m[1].toLowerCase().replace("jpg", "jpeg");
    const b64raw = m[2].replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64raw)) return { ok: false, reason: "bad_base64" };
    return { ok: true, kind: "data", url: `data:image/${mime};base64,${b64raw}`, mime: `image/${mime}`, b64: b64raw };
  }

  // Base64 nu → devine le mime (png vs jpeg)
  const looksPng = trimmed.startsWith("iVBORw0KGgo");
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    const mime = looksPng ? "image/png" : "image/jpeg";
    return { ok: true, kind: "data", url: `data:${mime};base64,${trimmed}`, mime, b64: trimmed };
  }

  return { ok: false, reason: "unsupported" };
}

// Log “safe” (aperçu tronqué)
function shortPreview(u: string) {
  return u.length <= 100 ? u : `${u.slice(0, 80)}…(${u.length} chars)`;
}

/* ============ Upload Supabase (convertit data URL → https public) ============ */
// Utilise un bucket public (lecture publique). Configurez ANALYZE_UPLOAD_BUCKET si besoin.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.toString();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UPLOAD_BUCKET = process.env.ANALYZE_UPLOAD_BUCKET || "analyze-uploads-public";

// Envoie le binaire (base64) dans Supabase Storage et retourne l'URL publique https
async function uploadToSupabasePublic(filename: string, mime: string, base64Data: string): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase storage non configuré (NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant).");
  }
  const bytes = Buffer.from(base64Data, "base64");
  const key = `${UPLOAD_BUCKET}/${filename}`;
  const endpoint = `${SUPABASE_URL}/storage/v1/object/${key}`;

  const controller = new AbortController();
  const put = fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": mime,
      "x-upsert": "true",
    },
    body: bytes,
    signal: controller.signal,
  }).then(async (resp) => {
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Supabase upload ${resp.status}: ${txt}`);
    }
    return true;
  });

  await withTimeout(put, 10000, () => controller.abort("supabase_upload_timeout"));

  // URL publique (le bucket doit être PUBLIC)
  // Chemin public: /storage/v1/object/public/<bucket>/<file>
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${UPLOAD_BUCKET}/${filename}`;
  return publicUrl;
}

/* ============ Pacing & lock mémoire (fallback) ============ */
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

/* ============ Cache mémoire anti double-clic ============ */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { t: number; json: AIAnalysis }>();

/* ============ Upstash Redis (optionnel) ============ */
function upstashAvailable() {
  return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
}
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

/* ============ GET /api/analyze (diagnostic rapide) ============ */
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

/* ============ POST /api/analyze — SSE + upload Supabase + Chat Completions ============ */
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

    // ---- Normaliser & valider l'image
    const imgNorm = sanitizeImageInput(frames[0]);
    if (!imgNorm.ok) {
      return jsonError(400, `Format d'image invalide (${imgNorm.reason}). Utilisez https://... ou data:image/...;base64,...`);
    }

    // ---- Convertir data URL -> https via Supabase (si besoin)
    let imageUrl = imgNorm.url;
    if (imgNorm.ok && imgNorm.kind === "data") {
      try {
        const ext = imgNorm.mime?.split("/")[1] || "jpeg";
        const fname = `analyze_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        imageUrl = await uploadToSupabasePublic(fname, imgNorm.mime || "image/jpeg", imgNorm.b64!);
      } catch (e: any) {
        // Si upload impossible, on tente quand même le data URL côté OpenAI (ça marchera sur certains déploiements)
        console.warn("[analyze] Supabase upload failed, fallback to data url:", e?.message || e);
      }
    }

    console.log("[analyze] image_url:", shortPreview(imageUrl));

    // ---- Rate-limit (configurable) : by-pass en dev
    const isProd = process.env.NODE_ENV === "production";
    const RL_IP_LIMIT   = Number(process.env.ANALYZE_RL_IP_LIMIT   || 3);   // 3 req
    const RL_IP_WINDOW  = Number(process.env.ANALYZE_RL_IP_WINDOW  || 60);  // / 60 s
    const RL_ORG_LIMIT  = Number(process.env.ANALYZE_RL_ORG_LIMIT  || 10);  // 10 req
    const RL_ORG_WINDOW = Number(process.env.ANALYZE_RL_ORG_WINDOW || 60);  // / 60 s

    const userId = (req.headers.get("x-user-id") || "").trim();
    const rlKeyIp  = userId ? `analyze:user:${userId}` : `analyze:ip:${clientIp(req)}`;
    const rlKeyOrg = `analyze:org:global`;

    if (isProd) {
      if (upstashAvailable()) {
        const ipRes  = await fixedWindowLimit(rlKeyIp, RL_IP_LIMIT, RL_IP_WINDOW);
        if (!ipRes.success) {
          const retry = Math.max(1, Math.ceil((ipRes.reset - Date.now()) / 1000));
          return jsonError(429, "rate_limit_per_ip", { "retry-after": String(retry) });
        }
        const orgRes = await fixedWindowLimit(rlKeyOrg, RL_ORG_LIMIT, RL_ORG_WINDOW);
        if (!orgRes.success) {
          const retry = Math.max(1, Math.ceil((orgRes.reset - Date.now()) / 1000));
          return jsonError(429, "rate_limit_org", { "retry-after": String(retry) });
        }
      } else {
        const now = Date.now();
        const SOFT_WINDOW = RL_IP_WINDOW * 1000;
        const SOFT_LIMIT  = RL_IP_LIMIT;
        const key = rlKeyIp;
        const lastByKey: Map<string, number[]> = (global as any).__analyze_rl || ((global as any).__analyze_rl = new Map());
        const arr = lastByKey.get(key) || [];
        const arr2 = arr.filter((t) => now - t < SOFT_WINDOW);
        arr2.push(now);
        lastByKey.set(key, arr2);
        if (arr2.length > SOFT_LIMIT) {
          const retryMs = SOFT_WINDOW - (now - arr2[0]);
          const retry = Math.max(1, Math.ceil(retryMs / 1000));
          return jsonError(429, "rate_limit_per_ip", { "retry-after": String(retry) });
        }
      }
    }

    // ---- Cache mémoire
    const key = hashKey(frames, feeling || "", economyMode);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < CACHE_TTL_MS) {
      return NextResponse.json(hit.json, { headers: { "Cache-Control": "no-store, no-transform" } });
    }

    // ---- Instruction commune
    const instruction =
      'Analyse d’une image mosaïque issue d’une vidéo de musculation. ' +
      'Réponds STRICTEMENT en JSON: {"exercise":string,"confidence":number,"overall":string,"muscles":string[],"cues":string[],"extras":string[],"timeline":[{"time":number,"label":string,"detail"?:string}]}. ' +
      'Limite à 3 muscles, 3 cues max, timeline 2 points pertinents.';

    const partsText: string[] = [instruction];
    if (feeling) partsText.push(`Ressenti: ${feeling}`);
    if (fileUrl) partsText.push(`URL vidéo: ${fileUrl}`);
    if (typeof timestamps[0] === "number") partsText.push(`repere=${Math.round(timestamps[0])}s`);

    // ---- SSE (heartbeats + result/error)
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const writeSSE = (event: string, data: any) =>
      writer.write(encoder.encode(`event: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`));
    const writeComment = (comment: string) => writer.write(encoder.encode(`: ${comment}\n\n`));
    const hb = setInterval(() => writeComment("heartbeat"), 1000);

    // ---- Appel OpenAI (Chat Completions, image_url: { url: https })
    (async () => {
      try {
        await pace();

        const controller = new AbortController();
        const p = fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "gpt-4o",          // plus tolérant
            temperature: 0.2,
            max_tokens: 200,
            messages: [
              { role: "system", content: "Réponds STRICTEMENT en JSON." },
              {
                role: "user",
                content: [
                  { type: "text", text: partsText.join("\n") },
                  { type: "image_url", image_url: { url: imageUrl } }
                ]
              }
            ]
          }),
          signal: controller.signal,
        }).then(async (resp) => {
          const txt = await resp.text().catch(() => "");
          if (!resp.ok) {
            let parsed:any=null; try { parsed = JSON.parse(txt);} catch {}
            const err:any = new Error(parsed?.error?.message || txt || `OpenAI HTTP ${resp.status}`);
            err.status = resp.status; err.details = parsed?.error ?? txt; err.retryAfter = resp.headers.get("retry-after") || "";
            throw err;
          }
          try {
            return JSON.parse(txt);
          } catch {
            const err:any = new Error("Réponse OpenAI non JSON.");
            err.status = 502; err.details = txt?.slice?.(0, 500);
            throw err;
          }
        });

        const json = await withTimeout(p, 20_000, () => controller.abort("openai_timeout"));

        const text: string =
          json?.choices?.[0]?.message?.content || json?.output_text || json?.content?.[0]?.text || "";

        if (!text) throw Object.assign(new Error("Réponse vide du modèle."), { status: 502 });

        let parsed: AIAnalysis | null = null;
        try { parsed = JSON.parse(text); }
        catch {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
        }
        if (!parsed || typeof parsed !== "object") {
          throw Object.assign(new Error("Impossible de parser la réponse JSON."), { status: 502 });
        }
        parsed.muscles ||= []; parsed.cues ||= []; parsed.extras ||= []; parsed.timeline ||= [];

        cache.set(key, { t: Date.now(), json: parsed });

        await writeSSE("result", parsed);
      } catch (e: any) {
        const status = e?.status ?? e?.response?.status;
        if (status === 429) {
          await writeSSE("error", { code: "rate_limit_exceeded", retryAfter: e?.retryAfter || "20", details: e?.details || String(e?.message || e) });
        } else if (status === 400 && /image|pattern|url/i.test(String(e?.details || e?.message || ""))) {
          await writeSSE("error", { code: "bad_image_url", message: "Image invalide (URL http(s) ou data URL base64 attendu).", details: e?.details || String(e?.message || e) });
        } else if (status === 504 || /timeout|gateway_timeout/i.test(String(e?.message || e))) {
          await writeSSE("error", { code: "gateway_timeout", retryAfter: "12" });
        } else {
          await writeSSE("error", { code: "internal_error", message: String(e?.message || e), details: e?.details });
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
        "X-Accel-Buffering": "no"
      },
    });

  } catch (e: any) {
    const status = e?.status ?? e?.response?.status;
    const msg = e?.message || "Erreur interne";
    if (Number.isInteger(status)) return jsonError(status, msg);
    return jsonError(500, msg);
  }
}
