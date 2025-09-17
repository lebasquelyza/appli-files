// app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";

type AnalysisPoint = { time: number; label: string; detail?: string };
type AIAnalysis = {
  overall: string;
  muscles: string[];
  cues: string[];
  extras?: string[];
  timeline: AnalysisPoint[];
};

// --- Mock d'analyse (remplace par ton vrai modèle plus tard)
async function mockAnalyze(_src: { fileUrl?: string; fileName?: string }, feeling: string): Promise<AIAnalysis> {
  const extras: string[] = [];
  const f = (feeling || "").toLowerCase();
  if (f.includes("dos")) extras.push("Renforcer le gainage lombaire (bird-dog, planche latérale).");
  if (f.includes("genou")) extras.push("Pense à pousser le genou vers l'extérieur (alignement pied/genou/hanche).");

  return {
    overall:
      "Bonne maîtrise globale. Légère bascule du buste en sortie de trou, vitesse irrégulière sur les dernières reps. Rester gainé et garder la trajectoire du centre de masse au milieu du pied.",
    muscles: ["Quadriceps", "Fessiers", "Ischios", "Érecteurs du rachis", "Gainage"],
    cues: [
      "Pieds vissés dans le sol, voûte plantaire active.",
      "Genoux suivent la pointe de pieds, légère ouverture vers l’extérieur.",
      "Cage thoracique empilée sur le bassin, respiration 360° avant la descente.",
      "Contrôle excentrique, remonter en poussant le sol.",
    ],
    extras,
    timeline: [
      { time: 3, label: "Rep 1 – depth ok", detail: "Hanches sous le parallèle, dos neutre." },
      { time: 9, label: "Rep 2 – genou rentre", detail: "Cue 'genou dehors'." },
      { time: 14, label: "Rep 3 – bascule avant", detail: "Pense 'poitrine fière'." },
      { time: 21, label: "Rep 4 – tempo ok" },
      { time: 27, label: "Rep 5 – grind", detail: "Rester gainé, souffle bloqué jusqu’à mi-amplitude." },
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const ctype = req.headers.get("content-type") || "";

    // 1) Nouveau flux: JSON { fileUrl, feeling }
    if (ctype.includes("application/json")) {
      const { fileUrl, feeling = "" } = await req.json();
      if (!fileUrl) {
        return NextResponse.json({ error: "fileUrl manquant" }, { status: 400 });
      }
      const out = await mockAnalyze({ fileUrl }, feeling);
      return NextResponse.json(out);
    }

    // 2) Ancien flux: FormData { video: File, feeling }
    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      const video = form.get("video") as File | null;
      const feeling = (form.get("feeling") as string) || "";
      if (!video) {
        return NextResponse.json({ error: "Aucun fichier vidéo reçu" }, { status: 400 });
      }
      const out = await mockAnalyze({ fileName: video.name }, feeling);
      return NextResponse.json(out);
    }

    return NextResponse.json({ error: "Content-Type non supporté" }, { status: 415 });
  } catch (err: any) {
    console.error("Erreur /api/analyze:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

// Empêche tout pré-rendu de cette route pendant le build
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
