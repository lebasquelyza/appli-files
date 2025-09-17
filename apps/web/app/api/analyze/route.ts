import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const video = form.get("video");
  const feeling = (form.get("feeling") as string | null) ?? "";

  if (!video || !(video instanceof File)) {
    return NextResponse.json({ error: "video file manquant" }, { status: 400 });
  }

  // Ici tu uploaderais la vidéo vers ton stockage (S3, GCS…) et lancerais ton pipeline ML
  // Pour la démo on renvoie un JSON « analyse » cohérent avec le front.
  const extras: string[] = [];
  const f = feeling.toLowerCase();
  if (f.includes("dos")) extras.push("Renforcer le gainage lombaire (bird-dog, planche latérale).");
  if (f.includes("genou")) extras.push("Pense à pousser le genou droit vers l'extérieur (alignement pied/genou/hanche).");

  const analysis = {
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

  return NextResponse.json(analysis);
}
