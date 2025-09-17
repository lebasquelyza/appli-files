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

    // 1) flux JSON attendu: { fileUrl?: string, feeling?: string, frames: string[] (dataURL/base64), timestamps: number[] }
    if (!ctype.includes("application/json")) {
      return bad(415, "Envoie JSON { frames: base64[], timestamps: number[], feeling?: string, fileUrl?: string }");
    }

    const body = await req.json();
    const frames: string[] = Array.isArray(body.frames) ? body.frames : [];
    const timestamps: number[] = Array.isArray(body.timestamps) ? body.timestamps : [];
    const feeling: string = typeof body.feeling === "string" ? body.feeling : "";
    const fileUrl: string | undefined = typeof body.fileUrl === "string" ? body.fileUrl : undefined;

    if (!frames.length) return bad(400, "Aucune frame fournie.");
    if (!process.env.OPENAI_API_KEY) return bad(500, "OPENAI_API_KEY manquante.");

    // 2) Construit le prompt + messages multimodaux
    const userParts: any[] = [
      {
        type: "text",
        text:
          "Analyse ces images extraites d'une vidéo d'entraînement. " +
          "1) Détecte l'exercice (ex: tractions, squat, pompe, SDT, bench, row, dips, hip thrust, overhead press, etc.). " +
          "2) Donne les muscles principaux réellement sollicités pour CET EXERCICE. " +
          "3) Génère 3-6 'cues' (consignes) concrets, adaptés à la posture visible. " +
          "4) Si tu repères des défauts (genou rentrant, balancement, amplitude partielle, perte de gainage…), donne des conseils précis. " +
          "5) Utilise le ressenti si pertinent. " +
          "Réponds en JSON strict, champ par champ, conforme au schéma: " +
          "{exercise, confidence, overall, muscles[], cues[], extras[], timeline[{time,label,detail?}]}. " +
          "Ne mets pas de texte hors JSON.",
      },
    ];

    // Ajoute le feeling et l’URL si présents
    if (feeling) {
      userParts.push({ type: "text", text: `Ressenti athlète: ${feeling}` });
    }
    if (fileUrl) {
      userParts.push({ type: "text", text: `URL vidéo (réf): ${fileUrl}` });
    }

    // Ajoute les frames (images base64)
    frames.forEach((dataUrl: string, i: number) => {
      userParts.push({
        type: "input_image",
        image_data: {
          data: dataUrl.split(",")[1], // retire le prefix "data:image/jpeg;base64,"
          mime_type: "image/jpeg",
        },
      });
      if (typeof timestamps[i] === "number") {
        userParts.push({ type: "text", text: `timestamp: ${timestamps[i]}s` });
      }
    });

    // 3) Appel OpenAI Responses API (vision)
    // Remplace "gpt-4o-mini" par le modèle visuel dispo dans ton compte si besoin
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [{ role: "user", content: userParts }],
        temperature: 0.3,
        // On peut forcer un format JSON strict (si dispo dans ton compte):
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      return bad(500, `OpenAI error ${resp.status}: ${txt}`);
    }
    const json = await resp.json();

    // La réponse textuelle est dans output_text (Responses API)
    const text = json?.output_text || json?.content?.[0]?.text || "";
    if (!text) return bad(500, "Réponse vide du modèle.");

    let parsed: AIAnalysis | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // fallback: tente d'extraire du JSON brut (si le modèle a renvoyé du bruit)
      const m = text.match(/\{[\s\S]*\}$/);
      if (m) {
        parsed = JSON.parse(m[0]);
      }
    }
    if (!parsed) return bad(500, "Impossible de parser la réponse JSON.");

    // Petites garanties de type
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
