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

function bad(status: number, msg: string) {
  return NextResponse.json({ error: msg }, { status });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

// Retry simple avec backoff
async function withBackoff<T>(fn: () => Promise<T>, tries = 2) {
  let lastErr: any;
  for (let i = 0; i <= tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const status = e?.status ?? e?.response?.status;
      const is429 = status === 429 || /rate[_\s-]?limit/i.test(String(e?.message || ""));
      if (!is429 || i === tries) throw e;
      // backoff (1.5s puis 3s)
      const delay = 1500 * (i + 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function POST(req: NextRequest) {
  try {
    const ctype = (req.headers.get("content-type") || "").toLowerCase();
    if (!ctype.includes("application/json")) {
      return bad(415, "Envoie JSON { frames: base64[], timestamps: number[], feeling?: string, fileUrl?: string }");
    }

    const body = await req.json();
    let frames: string[] = Array.isArray(body.frames) ? body.frames : [];
    let timestamps: number[] = Array.isArray(body.timestamps) ? body.timestamps : [];
    const feeling: string = typeof body.feeling === "string" ? body.feeling : "";
    const fileUrl: string | undefined = typeof body.fileUrl === "string" ? body.fileUrl : undefined;

    if (!frames.length) return bad(400, "Aucune frame fournie.");

    // 🔑 garde OPEN_API_KEY (fallback OPENAI_API_KEY)
    const apiKey = process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY || "";
    if (!apiKey) return bad(500, "Clé OpenAI manquante (OPEN_API_KEY ou OPENAI_API_KEY).");

    // ⚠️ Réduction d’empreinte token : max 4 frames, qualité + résolution plus faibles côté client recommandé
    if (frames.length > 4) {
      frames = frames.slice(0, 4);
      timestamps = timestamps.slice(0, 4);
    }

    // Prompt court (moins de tokens)
    const instruction =
      "Analyse des images de vidéo de musculation.\n" +
      "1) Détecte l'exercice (ex: tractions, squat, pompe, SDT, bench, row, dips, hip thrust, OHP, etc.).\n" +
      "2) Liste les muscles PRINCIPAUX pour CET exercice.\n" +
      "3) Donne 3–5 cues concrets adaptés à ce que tu vois.\n" +
      "4) Si défauts visibles (genou rentrant, balancement, amplitude partielle, perte de gainage…), propose des corrections précises.\n" +
      "Réponds UNIQUEMENT en JSON strict: " +
      '{"exercise":string,"confidence":number,"overall":string,"muscles":string[],"cues":string[],"extras":string[],"timeline":[{"time":number,"label":string,"detail"?:string}]}';

    const userParts: any[] = [{ type: "input_text", text: instruction }];
    if (feeling) userParts.push({ type: "input_text", text: `Ressenti: ${feeling}` });
    if (fileUrl) userParts.push({ type: "input_text", text: `URL vidéo: ${fileUrl}` });

    for (let i = 0; i < frames.length; i++) {
      const dataUrl = frames[i];
      // Responses API attend un image_url sous forme de string (data URL OK)
      userParts.push({
        type: "input_image",
        image_url: typeof dataUrl === "string" ? dataUrl : `data:image/jpeg;base64,${dataUrl}`,
      });
      if (typeof timestamps[i] === "number") {
        userParts.push({ type: "input_text", text: `t=${Math.round(timestamps[i])}s` });
      }
    }

    const call = async () => {
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
          // ↓ limite la taille de sortie
          max_output_tokens: 450,
          // ↓ format JSON strict (valeur supportée : json_object)
          text: { format: { type: "json_object" } },
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        const err = new Error(`OpenAI error ${resp.status}: ${txt}`);
        // @ts-ignore
        err.status = resp.status;
        throw err;
      }
      return resp.json();
    };

    const json = await withBackoff(call, 2);

    // Extraire le texte
    const text: string =
      json?.output_text ||
      json?.content?.[0]?.text ||
      json?.choices?.[0]?.message?.content ||
      "";

    if (!text) return bad(500, "Réponse vide du modèle.");

    let parsed: AIAnalysis | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}$/);
      if (m) parsed = JSON.parse(m[0]);
    }
    if (!parsed) return bad(500, "Impossible de parser la réponse JSON.");

    parsed.muscles ||= [];
    parsed.cues ||= [];
    parsed.extras ||= [];
    parsed.timeline ||= [];

    return NextResponse.json(parsed);
  } catch (e: any) {
    console.error("/api/analyze error:", e);
    return bad(500, e?.message || "Erreur interne");
  }
}
