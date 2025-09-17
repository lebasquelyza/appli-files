// apps/web/app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";

type AnalysisPoint = { time: number; label: string; detail?: string };
type AIAnalysis = {
  overall: string;
  muscles: string[];
  cues: string[];
  extras?: string[];
  timeline: AnalysisPoint[];
};

// --- Mock d'analyse (à remplacer par ton vrai pipeline)
async function mockAnalyze(
  _src: { fileUrl?: string; fileName?: string },
  feeling: string
): Promise<AIAnalysis> {
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

/**
 * Utilitaire: renvoie un JSON d'erreur standardisé
 */
function error(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const method = req.method.toUpperCase();
    if (method !== "POST") {
      return error(405, "Méthode non autorisée", { allowed: ["POST"] });
    }

    const ctype = (req.headers.get("content-type") || "").toLowerCase();

    // --- Flux 1 : JSON { fileUrl, feeling }
    if (ctype.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      const fileUrl = body?.fileUrl as string | undefined;
      const feeling = (body?.feeling as string) || "";

      if (!fileUrl || typeof fileUrl !== "string") {
        return error(400, "Paramètre 'fileUrl' manquant ou invalide.");
      }

      const out = await mockAnalyze({ fileUrl }, feeling);
      return NextResponse.json(out);
    }

    // --- Flux 2 : multipart/form-data { video: File, feeling }
    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      const video = form.get("video") as File | null;
      const feeling = (form.get("feeling") as string) || "";

      if (!video) {
        return error(400, "Aucun fichier 'video' reçu dans le form-data.");
      }

      const out = await mockAnalyze({ fileName: video.name }, feeling);
      return NextResponse.json(out);
    }

    // --- Fallback : tenter JSON, puis formData si content-type non standard
    try {
      const body = await req.json();
      if (body?.fileUrl) {
        const out = await mockAnalyze({ fileUrl: String(body.fileUrl) }, String(body.feeling || ""));
        return NextResponse.json(out);
      }
    } catch {
      // ignore et tente formData
      try {
        const form = await req.formData();
        const video = form.get("video") as File | null;
        const feeling = (form.get("feeling") as string) || "";
        if (video) {
          const out = await mockAnalyze({ fileName: video.name }, feeling);
          return NextResponse.json(out);
        }
      } catch {
        // ignore
      }
    }

    return error(415, "Content-Type non supporté. Utilise JSON { fileUrl, feeling } ou multipart/form-data { video, feeling }.");
  } catch (err: any) {
    console.error("Erreur /api/analyze:", err);
    return error(500, "Erreur interne");
  }
}

// Petit endpoint de diagnostic rapide: GET /api/analyze → { ok: true }
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/analyze", accepts: ["POST JSON {fileUrl, feeling}", "POST multipart/form-data {video, feeling}"] });
}

// Désactive le pré-rendu et force l’exécution Node.js
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
