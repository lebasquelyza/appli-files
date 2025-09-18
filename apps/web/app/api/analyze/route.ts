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

/** Récupère le texte JSON renvoyé par la Responses API, quels que soient
 *  le champ utilisé (output_text, output[], content[], choices…).
 */
function extractTextFromResponses(payload: any): string {
  if (!payload) return "";

  // 1) Nouveau champ direct
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  // 2) Nouveau format: output = [{type:"output_text", text:"..."}]
  if (Array.isArray(payload.output)) {
    const parts = payload.output
      .filter((p: any) => p && (p.type === "output_text" || typeof p.text === "string"))
      .map((p: any) => (typeof p.text === "string" ? p.text : ""))
      .join("\n")
      .trim();
    if (parts) return parts;
  }

  // 3) Ancien format éventuel
  if (Array.isArray(payload.content) && payload.content[0]?.text) {
    return String(payload.content[0].text);
  }
  if (Array.isArray(payload.choices) && payload.choices[0]?.message?.content) {
    return String(payload.choices[0].message.content);
  }

  // 4) fallback: cherche un blob JSON en fin de string
  const asStr = typeof payload === "string" ? payload : JSON.stringify(payload);
  const m = asStr.match(/\{[\s\S]*\}$/);
  return m ? m[0] : "";
}

export async function POST(req: NextRequest) {
  try {
    const ctype = (req.headers.get("content-type") || "").toLowerCase();
    if (!ctype.includes("application/json")) {
      return bad(415, "Envoie JSON { frames: base64[], timestamps: number[], feeling?: string, fileUrl?: string }");
    }

    const body = await req.json();
    const frames: string[] = Array.isArray(body.frames) ? body.frames : [];
    const timestamps: number[] = Array.isArray(body.timestamps) ? body.timestamps : [];
    const feeling: string = typeof body.feeling === "string" ? body.feeling : "";
    const fileUrl: string | undefined = typeof body.fileUrl === "string" ? body.fileUrl : undefined;

    if (!frames.length) return bad(400, "Aucune frame fournie.");

    // 🔑 on garde OPEN_API_KEY (fallback OPENAI_API_KEY)
    const apiKey = process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY || "";
    if (!apiKey) return bad(500, "Clé OpenAI manquante (OPEN_API_KEY ou OPENAI_API_KEY).");
    if (!apiKey.startsWith("sk-")) return bad(500, "Clé OpenAI invalide (doit commencer par 'sk-').");

    // ---- Construction du message multimodal (Responses API)
    const userParts: any[] = [
      {
        type: "input_text",
        text:
          "Analyse ces images extraites d'une vidéo d'entraînement.\n" +
          "1) Détecte l'exercice (tractions, squat, pompe, SDT, bench, row, dips, hip thrust, overhead press, etc.).\n" +
          "2) Donne les muscles PRINCIPAUX réellement sollicités pour CET EXERCICE.\n" +
          "3) Génère 3–6 cues concrets adaptés à ce que tu vois.\n" +
          "4) S'il y a des défauts (genou rentrant, balancement, amplitude partielle, perte de gainage…), propose des corrections précises.\n" +
          "5) Utilise le ressenti si pertinent.\n" +
          'Réponds en JSON strict (pas de texte hors JSON) exactement: {"exercise":string,"confidence":number,"overall":string,"muscles":string[],"cues":string[],"extras":string[],"timeline":[{"time":number,"label":string,"detail"?:string}]}.',
      },
    ];
    if (feeling) userParts.push({ type: "input_text", text: `Ressenti athlète: ${feeling}` });
    if (fileUrl) userParts.push({ type: "input_text", text: `URL vidéo (réf): ${fileUrl}` });

    const maxFrames = Math.min(frames.length, 8); // limite pour éviter payloads énormes
    for (let i = 0; i < maxFrames; i++) {
      const dataUrl = frames[i];
      // autorise "data:image/jpeg;base64,..." ou base64 pur
      const base64 =
        typeof dataUrl === "string" && dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;

      userParts.push({
        type: "input_image",
        image_data: { data: base64, mime_type: "image/jpeg" },
      });

      if (typeof timestamps[i] === "number") {
        userParts.push({ type: "input_text", text: `timestamp: ${timestamps[i]}s` });
      }
    }

    // ✅ Responses API : format JSON via text.format
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
        text: { format: "json" }, // important: remplace l'ancien response_format
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      if (resp.status === 401) return bad(500, `OpenAI 401: clé invalide côté serveur. Détail: ${txt}`);
      if (resp.status === 400) return bad(500, `OpenAI 400: requête invalide. Détail: ${txt}`);
      return bad(500, `OpenAI error ${resp.status}: ${txt}`);
    }

    const payload = await resp.json();
    const text = extractTextFromResponses(payload);
    if (!text) return bad(500, "Réponse vide du modèle.");

    let parsed: AIAnalysis | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // dernier recours: essaie d’extraire un bloc JSON terminal
      const m = text.match(/\{[\s\S]*\}$/);
      if (m) parsed = JSON.parse(m[0]);
    }
    if (!parsed) return bad(500, "Impossible de parser la réponse JSON.");

    // garanties minimales
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
