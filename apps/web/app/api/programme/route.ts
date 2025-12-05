// apps/web/app/api/programme/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAnswersForEmail,
  generateProgrammeFromAnswers,
} from "../../../lib/coach/ai";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = String(
      searchParams.get("email") || cookies().get("app_email")?.value || ""
    )
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json(
        { sessions: [], error: "Aucun email." },
        { status: 200 }
      );
    }

    // 1) Récupération des réponses depuis le Google Sheet
    const answers = await getAnswersForEmail(email, { fresh: true });

    if (!answers) {
      return NextResponse.json(
        { sessions: [], error: "Aucune réponse trouvée pour cet email." },
        { status: 200 }
      );
    }

    // ⭐ Langue depuis le cookie fc-lang (robuste: "en", "EN", "en-US", etc.)
    const rawLang = cookies().get("fc-lang")?.value || "";
    const lang: "fr" | "en" =
      rawLang.toLowerCase().startsWith("en") ? "en" : "fr";

    (answers as any).lang = lang;

    // 2) Génération du programme via IA (LLM) + fallback “béton”
    const { sessions: rawSessions } = await generateProgrammeFromAnswers(answers);

    // 3) Normalisation de base (sécurité) + ajustement du titre selon la langue
    const sessions = (rawSessions || []).map((s, i) => {
      let title =
        s.title ||
        (lang === "en" ? `Workout ${i + 1}` : `Séance ${i + 1}`);

      // 🔤 Post-traitement des titres en fonction de la langue
      if (lang === "en") {
        // On normalise pour enlever les accents, pour détecter "Séance" / "Seance"
        const normalized = (title || "")
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "");

        // Cas 1 : "Séance pour X …"
        // ex: "Séance pour Lyza — Lundi · Full body"
        if (/^Seance pour\s+/i.test(normalized)) {
          // On enlève le "Séance pour " / "Seance pour " sur la version originale
          const after = title
            .replace(/^Séance pour\s+/i, "")
            .replace(/^Seance pour\s+/i, "");
          title = `Workout for ${after}`;
        }
        // Cas 2 : "Séance ..." (sans "pour")
        // ex: "Séance 1", "Séance — Lundi"
        else if (/^Seance\b/i.test(normalized)) {
          title = title
            .replace(/^Séance\b/i, "Workout")
            .replace(/^Seance\b/i, "Workout");
        }
      }

      return {
        ...s,
        date: s.date || "",
        id: s.id || `session-${i + 1}`,
        title,
      };
    });

    return NextResponse.json({ sessions }, { status: 200 });
  } catch (e: any) {
    console.error("[API /programme] Erreur:", e);
    return NextResponse.json(
      { sessions: [], error: "Programme indisponible." },
      { status: 200 }
    );
  }
}
