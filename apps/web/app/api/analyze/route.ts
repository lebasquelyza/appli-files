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

/* ============ Next runtime ============ */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

/* ============ Utils ============ */
function jsonError(status: number, msg: string, extra: Record<string, string> = {}) {
  return new NextResponse(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json", "Cache-Control": "no-store, no-transform", ...extra },
  });
}
function hashKey(frames: string[], feeling: string, economy: boolean) {
  const s = frames.join("|").slice(0, 2000) + "::" + (feeling || "") + "::" + (economy ? "e1" : "e0");
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error("timeout"), { status: 504 })), ms);
    p.then(v => { clearTimeout(t); resolve(v); })
     .catch(e => { clearTimeout(t); reject(e); });
  });
}

/* ============ Image sanitizer ============ */
type SanitizeOk = { ok: true; url: string; kind: "https" | "data" };
type SanitizeErr = { ok: false; reason: "empty" | "blob_url" | "bad_base64" | "unsupported" };
type SanitizeResult = SanitizeOk | SanitizeErr;

function sanitizeImageInput(raw: string): SanitizeResult {
  const s = (raw || "").trim();
  if (!s) return { ok: false, reason: "empty" };
  if (/^blob:/i.test(s)) return { ok: false, reason: "blob_url" };
  if (/^https:\/\/.+/i.test(s)) return { ok: true, url: s, kind: "https" };
  const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(s);
  if (m) {
    const mime = m[1].toLowerCase().replace("jpg", "jpeg");
    const b64 = m[2].replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { ok: false, reason: "bad_base64" };
    if (b64.length > 10 * 1024 * 1024) return { ok: false, reason: "unsupported" };
    return { ok: true, url: `data:image/${mime};base64,${b64}`, kind: "data" };
  }
  // base64 nu
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(s)) {
    const looksPng = s.startsWith("iVBORw0KGgo");
    const mime = looksPng ? "image/png" : "image/jpeg";
    return { ok: true, url: `data:${mime};base64,${s}`, kind: "data" };
  }
  return { ok: false, reason: "unsupported" };
}
function shortPreview(u: string) { return u.length <= 100 ? u : `${u.slice(0, 80)}…(${u.length} chars)`; }

/* ============ Cache (anti double-clic) ============ */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { t: number; json: AIAnalysis }>();

/* ============ GET diag ============ */
export async function GET() {
  const hasOpenAI = !!(process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY);
  return NextResponse.json(
    { ok: true, openaiKey: hasOpenAI, cacheKeys: cache.size },
    { headers: { "Cache-Control": "no-store, no-transform" } }
  );
}

/* ============ POST (JSON → JSON) ============ */
export async function POST(req: NextRequest) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return jsonError(415, "JSON attendu: { frames: string[], timestamps?: number[], feeling?: string, selftest?: boolean }");
    }

    const body = await req.json();
    const selftest: boolean = !!body.selftest;
    let frames: string[] = Array.isArray(body.frames) ? body.frames : [];
    let timestamps: number[] = Array.isArray(body.timestamps) ? body.timestamps : [];
    const feeling: string = typeof body.feeling === "string" ? body.feeling : "";
    const economy: boolean = body.economyMode !== false;

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || "";
    if (!apiKey) return jsonError(500, "Clé OpenAI manquante (OPENAI_API_KEY ou OPEN_API_KEY).");

    const ONE_BY_ONE_DATA_URL =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/az9nS0AAAAASUVORK5CYII=";

    if (!selftest && !frames.length) return jsonError(400, "Aucune frame fournie.");
    if (frames.length > 1) { frames = frames.slice(0, 1); timestamps = timestamps.slice(0, 1); }

    const rawImage = selftest ? ONE_BY_ONE_DATA_URL : frames[0];
    const img = sanitizeImageInput(rawImage);
    if (!img.ok) {
      return jsonError(400, `Image invalide (${img.reason}). Attendu: https://… ou data:image/...;base64,...`);
    }
    const imageUrl = img.url;
    console.log("[analyze] image_url:", shortPreview(imageUrl), selftest ? "(selftest)" : "");

    // cache
    const key = selftest ? "selftest" : hashKey(frames, feeling || "", economy);
    const hit = !selftest ? cache.get(key) : null;
    if (hit && Date.now() - hit.t < CACHE_TTL_MS) {
      return NextResponse.json(hit.json, { headers: { "Cache-Control": "no-store, no-transform" } });
    }

    // prompt compact
    const instruction =
      'Analyse d’une image mosaïque issue d’une vidéo de musculation. ' +
      'Réponds STRICTEMENT en JSON: {"exercise":string,"confidence":number,"overall":string,"muscles":string[],"cues":string[],"extras":string[],"timeline":[{"time":number,"label":string,"detail"?:string}]}. ' +
      'Limite à 3 muscles, 3 cues max, timeline 2 points pertinents.';

    const userTextParts: string[] = [instruction];
    if (feeling) userTextParts.push(`Ressenti: ${feeling}`);
    if (typeof timestamps[0] === "number") userTextParts.push(`repere=${Math.round(timestamps[0])}s`);

    // Appel OpenAI (chat/completions avec image)
    const p = fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        max_tokens: 200,
        messages: [
          { role: "system", content: "Réponds STRICTEMENT en JSON." },
          {
            role: "user",
            content: [
              { type: "text", text: userTextParts.join("\n") },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    }).then(async (resp) => {
      const txt = await resp.text().catch(() => "");
      if (!resp.ok) {
        let parsed: any = null; try { parsed = JSON.parse(txt); } catch {}
        const err: any = new Error(parsed?.error?.message || txt || `HTTP ${resp.status}`);
        err.status = resp.status; err.details = parsed?.error ?? txt;
        throw err;
      }
      try { return JSON.parse(txt); }
      catch {
        const err: any = new Error("Réponse OpenAI non JSON.");
        err.status = 502; err.details = txt?.slice?.(0, 500);
        throw err;
      }
    });

    const json = await withTimeout(p, 20_000);
    const text: string = json?.choices?.[0]?.message?.content || "";
    if (!text) return jsonError(502, "Réponse vide du modèle.");

    let parsed: AIAnalysis | null = null;
    try { parsed = JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    if (!parsed || typeof parsed !== "object") {
      return jsonError(502, "Impossible de parser la réponse JSON.");
    }

    parsed.muscles ||= []; parsed.cues ||= []; parsed.extras ||= []; parsed.timeline ||= [];

    if (!selftest) cache.set(key, { t: Date.now(), json: parsed });
    return NextResponse.json(parsed, { headers: { "Cache-Control": "no-store, no-transform" } });
  } catch (e: any) {
    const status = e?.status ?? e?.response?.status;
    return jsonError(Number.isInteger(status) ? status : 500, e?.message || "Erreur interne");
  }
}


