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

    // ⭐ NEW : déterminer la langue depuis le cookie fc-lang
    const langCookie = cookies().get("fc-lang")?.value;
    const lang: "fr" | "en" = langCookie === "en" ? "en" : "fr";
    (answers as any).lang = lang;

    // 2) Génération du programme via IA (LLM) + fallback “béton”
    const { sessions: rawSessions } = await generateProgrammeFromAnswers(answers);

    // 3) Normalisation de base (sécurité)
    const sessions = (rawSessions || []).map((s, i) => ({
      ...s,
      date: s.date || "",
      id: s.id || `session-${i + 1}`,
      // 🔹 Fallback titre FR / EN
      title:
        s.title ||
        (lang === "en" ? `Session ${i + 1}` : `Séance ${i + 1}`),
    }));

    return NextResponse.json({ sessions }, { status: 200 });
  } catch (e: any) {
    console.error("[API /programme] Erreur:", e);
    return NextResponse.json(
      { sessions: [], error: "Programme indisponible." },
      { status: 200 }
    );
  }
}
