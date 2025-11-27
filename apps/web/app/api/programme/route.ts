// apps/web/app/api/programme/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAnswersForEmail,
  generateProgrammeFromAnswers,
  type NormalizedExercise,
} from "../../../lib/coach/ai";

export const runtime = "nodejs";

/**
 * Mini trad FR → EN pour certains noms d'exercices.
 * On ne touche qu'à l'affichage (champ name), les autres données restent identiques.
 */
function translateExerciseName(
  name: string | undefined,
  lang: "fr" | "en"
): string {
  if (!name) return "";
  if (lang === "fr") return name;

  const clean = name.trim();

  const map: Record<string, string> = {
    // Muscu sans matériel
    "Squat au poids du corps": "Bodyweight squat",
    "Pompes": "Push-ups",
    "Fentes alternées": "Alternating lunges",
    "Planche": "Plank",

    // Muscu avec matériel
    "Goblet Squat": "Goblet squat",
    "Développé haltères": "Dumbbell press",
    "Rowing unilatéral": "One-arm row",

    // Cardio
    "Échauffement Z1": "Warm-up Z1",
    "Cardio continu Z2": "Continuous cardio Z2",
    "Retour au calme + mobilité": "Cool-down + mobility",
    "Marche progressive Z1→Z2": "Progressive walk Z1→Z2",

    // Mobilité
    "Respiration diaphragmatique": "Diaphragmatic breathing",
    "90/90 hanches": "90/90 hips",
    "T-spine rotations": "T-spine rotations",
    "Down-Dog → Cobra": "Down-Dog → Cobra",
  };

  return map[clean] ?? name;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // 🔤 Langue depuis le cookie (même logique que partout ailleurs)
    const cookieLang = cookies().get("fc-lang")?.value;
    const lang: "fr" | "en" = cookieLang === "en" ? "en" : "fr";

    const email = String(
      searchParams.get("email") || cookies().get("app_email")?.value || ""
    )
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json(
        {
          sessions: [],
          error:
            lang === "en" ? "No email." : "Aucun email.",
        },
        { status: 200 }
      );
    }

    // 1) Récupération des réponses depuis le Google Sheet
    const answers = await getAnswersForEmail(email, { fresh: true });

    if (!answers) {
      return NextResponse.json(
        {
          sessions: [],
          error:
            lang === "en"
              ? "No answers found for this email."
              : "Aucune réponse trouvée pour cet email.",
        },
        { status: 200 }
      );
    }

    // 2) Génération du programme via IA (LLM) + fallback “béton”
    const { sessions: rawSessions } =
      await generateProgrammeFromAnswers(answers);

    // 3) Normalisation + traduction minimale côté serveur
    const sessions = (rawSessions || []).map((s, i) => {
      const exos = (s.exercises || []) as NormalizedExercise[];

      const translatedExercises = exos.map((ex) => ({
        ...ex,
        // On ne traduit le nom que si on est en EN, le reste reste brut
        name: translateExerciseName(ex.name, lang),
      }));

      return {
        ...s,
        exercises: translatedExercises,
        date: s.date || "",
        id: s.id || `session-${i + 1}`,
        title:
          s.title ||
          (lang === "en" ? `Session ${i + 1}` : `Séance ${i + 1}`),
      };
    });

    return NextResponse.json({ sessions }, { status: 200 });
  } catch (e: any) {
    console.error("[API /programme] Erreur:", e);

    // Lang ici aussi (si erreur très tôt, on relit le cookie)
    const cookieLang = cookies().get("fc-lang")?.value;
    const lang: "fr" | "en" = cookieLang === "en" ? "en" : "fr";

    return NextResponse.json(
      {
        sessions: [],
        error:
          lang === "en"
            ? "Program unavailable."
            : "Programme indisponible.",
      },
      { status: 200 }
    );
  }
}
