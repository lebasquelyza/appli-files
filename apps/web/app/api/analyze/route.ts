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

/* -------------------- Anti-burst pacing (lissage) -------------------- */
let lastCall = 0;
const MIN_SPACING_MS = 600; // espace mini entre appels sortants (augmenté)
async function pace() {
  const now = Date.now();
  const wait = Math.max(0, lastCall + MIN_SPACING_MS - now);
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

/* -------------------- Sémaphore (concurrence=1) -------------------- */
let inFlight = 0;
async function withSemaphore<T>(fn: () => Promise<T>) {
  while (inFlight >= 1) {
    await new Promise((r) => setTimeout(r, 50));
  }
  inFlight++;
  try { return await fn(); }
  finally { inFlight--; }
}

/* -------------------- Retry enveloppe (désactivé ici) -------------------- */
async function withBackoff<T>(fn: () => Promise<T>, tries = 0) {
  let lastErr: any;
  for (let i = 0; i <= tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const status = e?.status ?? e?.response?.status;
      const is429 =
        status === 429 ||
        e?.code === "rate_limit_exceeded" ||
        /rate[_\s-]?limit/i.test(String(e?.message || ""));
      if (!is429 || i === tries) throw e;
      const delay = 1500 * (i + 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/* -------------------- Mini cache anti double-clic -------------------- */
const cache = new Map<string, { t: number; json: AIAnalysis }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
function hashKey(frames: string[], feeling: string, economyMode: boolean) {
  const s = frames.join("|").slice(0, 2000) + "::" + (feeling || "") + "::" + (economyMode ? "e1" : "e0");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
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
    const economyMode: boolean = !!body.economyMode; // éco par défaut côté front

    if (!frames.length) return jsonError(400, "Aucune frame fournie.");

    const apiKey = process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY || "";
    if (!apiKey) return jsonError(500, "Clé OpenAI manquante (OPEN_API_KEY ou OPENAI_API_KEY).");

    // Cap images (2 en éco, 3 sinon)
    const cap = economyMode ? 2 : 3;
    if (frames.length > cap) {
      frames = frames.slice(0, cap);
      timestamps = timestamps.slice(0, cap);
    }

    // Instruction compacte en éco
    const instruction = economyMode
      ? 'Analyse rapide. Réponds STRICTEMENT en JSON: {"exercise":string,"confidence":number,"overall":string,"muscles":string[],"cues":string[],"extras":string[],"timeline":[{"time":number,"label":string,"detail"?:string}]}. Limite à 3 muscles, 3 cues max, timeline 2 points.'
      : "Analyse des images de vidéo de musculation.\n"
        + "1) Détecte l'exercice (ex: tractions, squat, pompe, SDT, bench, row, dips, hip thrust, OHP, etc.).\n"
        + "2) Liste les muscles PRINCIPAUX pour CET exercice.\n"
        + "3) Donne 3–5 cues concrets adaptés à ce que tu vois.\n"
        + "4) Si défauts visibles (genou rentrant, balancement, amplitude partielle, perte de gainage…), propose des corrections précises.\n"
        + "Réponds UNIQUEMENT en JSON strict: "
        + '{"exercise":string,"confidence":number,"overall":string,"muscles":string[],"cues":string[],"extras":string[],"timeline":[{"time":number,"label":string,"detail"?:string}]}';

    const userParts: any[] = [{ type: "input_text", text: instruction }];
    if (feeling) userParts.push({ type: "input_text", text: `Ressenti: ${feeling}` });
    if (fileUrl) userParts.push({ type: "input_text", text: `URL vidéo: ${fileUrl}` });
    for (let i = 0; i < frames.length; i++) {
      const dataUrl = frames[i];
      userParts.push({
        type: "input_image",
        image_url: typeof dataUrl === "string" ? dataUrl : `data:image/jpeg;base64,${dataUrl}`,
      });
      if (typeof timestamps[i] === "number") {
        userParts.push({ type: "input_text", text: `t=${Math.round(timestamps[i])}s` });
      }
    }

    // cache
    const key = hashKey(frames, feeling || "", economyMode);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.t < CACHE_TTL_MS) {
      return NextResponse.json(cached.json);
    }

    const maxOut = economyMode ? 180 : 320;

    const call = async () => {
      await pace(); // lissage
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
          // Responses API → forcer JSON strict ici
          text: { format: { type: "json_object" } },
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

    const json = await withSemaphore(() => withBackoff(call, 0)); // pas de retry auto

    // Extraire le texte de la Responses API
    const text: string =
      json?.output_text ||
      json?.content?.[0]?.text ||
      json?.choices?.[0]?.message?.content ||
      "";

    if (!text) return jsonError(502, "Réponse vide du modèle.");

    // Parsing JSON robuste
    let parsed: AIAnalysis | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}$/);
      if (m) parsed = JSON.parse(m[0]);
    }
    if (!parsed) return jsonError(502, "Impossible de parser la réponse JSON.");

    // Normalisation
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

    // Propager 429 + Retry-After
    const is429 =
      status === 429 ||
      e?.code === "rate_limit_exceeded" ||
      /rate[_\s-]?limit/i.test(String(msg));

    if (is429) {
      const retryAfter = e?.retryAfter || "60";
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
