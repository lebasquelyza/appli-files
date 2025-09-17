// app/api/analyze/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mock d'analyse IA (à remplacer par ton appel à un vrai modèle ou backend)
async function mockAnalyze(video: File, feeling: string) {
  const extras: string[] = [];
  if (feeling.toLowerCase().includes("dos")) extras.push("Renforcer le gainage lombaire (bird-dog, planche latérale).");
  if (feeling.toLowerCase().includes("genou")) extras.push("Pense à pousser le genou droit vers l'extérieur (alignment pied/genou/hanche).");

  return {
    overall:
      "Bonne maîtrise globale. Légère bascule du buste en sortie de trou, vitesse irrégulière sur les 2 dernières reps. Rester gainé et garder la trajectoire du centre de masse sur le milieu du pied.",
    muscles: ["Quadriceps", "Fessiers", "Ischios", "Érecteurs du rachis", "Gainage"],
    cues: [
      "Pieds vissés dans le sol, voûte plantaire active.",
      "Genoux suivent la pointe de pieds, légère ouverture vers l'extérieur.",
      "Cage thoracique empilée sur le bassin, respiration 360° avant la descente.",
      "Contrôle excentrique, remonter en poussant le sol (pas les épaules).",
    ],
    extras,
    timeline: [
      { time: 3, label: "Rep 1 – bon depth", detail: "Hanches sous le parallèle, dos neutre." },
      { time: 9, label: "Rep 2 – genou droit rentre", detail: "Ajouter le cue 'genou dehors'." },
      { time: 14, label: "Rep 3 – bascule avant", detail: "Penser 'coudes sous la barre, poitrine fière'." },
      { time: 21, label: "Rep 4 – tempo ok" },
      { time: 27, label: "Rep 5 – grind", detail: "Rester gainé, souffle bloqué jusqu'à mi-amplitude." },
    ],
  };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const video = formData.get("video") as File | null;
    const feeling = (formData.get("feeling") as string) || "";

    if (!video) {
      return NextResponse.json({ error: "Aucun fichier vidéo reçu" }, { status: 400 });
    }

    // TODO: remplacer mockAnalyze par ton pipeline IA (OpenAI, MoveNet, MediaPipe, etc.)
    const analysis = await mockAnalyze(video, feeling);

    return NextResponse.json(analysis);
  } catch (err) {
    console.error("Erreur analyse:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

