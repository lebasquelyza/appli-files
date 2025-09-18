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

export async function POST(req: NextRequest) {
  try {
    const ctype = (req.headers.get("content-type") || "").toLowerCase();

    // On attend du JSON: { frames: base64[], timestamps: number[], feeling?: string, fileUrl?: string }
    if (!ctype.includes("application/json")) {
      return bad(
        415,
        "Envoie JSON { frames: base64[], timestamps: number[], feeling?: string, fileUrl?: string }"
      );
    }

    const body = await req.json();

    const frames: string[] = Array.isArray(body.frames) ? body.frames : [];
    const timestamps: number[] = Array.isArray(body.timestamps) ? body.timestamps : [];
    const feeling: string = typeof body.feeling === "string" ? body.feeling : "";
    const fileUrl: string | undefined = typeof body.fileUrl === "string" ? body.fileUrl : undefined;

    if (!frames.length) return bad(400, "Aucune frame fournie.");

    // ✅ Utilise OPEN_API_KEY en priorité, puis OPENAI_API_KEY en fallback
    const apiKey =
      process.env.OPEN_API_KEY ||
      process.env.OPENAI_API_KEY ||
      "";

    if (!apiKey) {
      return bad(500, "Clé OpenAI manquante (OPEN_API_KEY ou OPENAI_API_KEY).");
    }
    if (!apiKey.startsWith("sk-")) {
      return bad(500, "Clé OpenAI invalide (doit commencer par 'sk-').");
    }

    // Construit le message multimodal pour la vision
    const userParts: any[] = [
      {
        type: "text",
        text:
          "Analyse ces images extraites d'une vidéo d'entraînement." +
          "\n1) Détecte l'exercice (ex: tractions, squat, pompe, SDT, bench, row, dips, hip thrust, overhead press, etc.)." +
          "\n2) Donne les muscles principaux réellement sollicités pour CET EXERCICE." +
          "\n3) Génère 3–6 'cues' (consignes) concrets, adaptés à la posture visible." +
          "\n4) Si tu repères des défauts (genou rentrant, balancement, amplitude partielle, perte de gainage…), donne des conseils précis." +
          "\n5) Utilise le ressenti si pertinent." +
          "\nRéponds en JSON strict, sans texte hors JSON, conforme au schéma: " +
          `{"exercise":string,"confidence":number,"overall":string,"muscles":string[],"cues":string[],"extras":string[],"timeline":[{"time":number,"label":string,"detail"?:string}]}`,
      },
    ];

    if (feeling) userParts.push({ type: "text", text: `Ressenti athlète: ${feeling}` });
    if (fileUrl) userParts.push({ type: "text", text: `URL vidéo (réf): ${fileUrl}` });

    // Limite de prudence: on n’envoie pas plus de 8 frames
    const maxFrames = Math.min(frames.length, 8);

    for (let i = 0; i < maxFrames; i++) {
      const dataUrl = frames[i];
      // data:image/jpeg;base64,XXXX
      const base64 = typeof dataUrl === "string" && dataUrl.includes(",")
        ? dataUrl.split(",")[1]
        : dataUrl;

      userParts.push({
        type: "input_image",
        image_data: {
          data: base64,
          mime_type: "image/jpeg",
        },
      });

      if (typeof timestamps[i] === "number") {
        userParts.push({ type: "text", text: `timestamp: ${timestamps[i]}s` });
      }
    }

    // Appel OpenAI Responses API (vision)
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [{ role: "user", content: userParts }],
        temperature: 0.3,
        response_format: { type: "json_object" }, // demande un JSON strict
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      if (resp.status === 401) {
        return bad(500, `OpenAI 401: clé invalide côté serveur. Détail: ${txt}`);
      }
      return bad(500, `OpenAI error ${resp.status}: ${txt}`);
    }

    const json = await resp.json();
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
      // fallback: tente d'extraire un JSON terminal
      const m = text.match(/\{[\s\S]*\}$/);
      if (m) {
        parsed = JSON.parse(m[0]);
      }
    }
    if (!parsed) return bad(500, "Impossible de parser la réponse JSON.");

    // Garanties de champs
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
