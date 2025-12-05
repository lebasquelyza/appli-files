// apps/web/app/api/answers/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAnswersForEmail,
  buildProfileFromAnswers,
  // ⬇️ Générateur qui produit les séances (IA + fallback béton)
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
        { answers: null, profile: null, sessions: [] },
        { status: 200 }
      );
    }

    // ✅ Récupère toujours la dernière ligne du Sheet
    const answers = await getAnswersForEmail(email, { fresh: true });
    if (!answers) {
      return NextResponse.json(
        { answers: null, profile: { email }, sessions: [] },
        { status: 200 }
      );
    }

    // ✅ Profil (compat existante)
    const profile = buildProfileFromAnswers(answers);

    // ✅ Séances générées par l’IA (fonction maintenant async → on AWAIT)
    const { sessions } = await generateProgrammeFromAnswers(answers);

    // 👀 Log dev pour vérifier qu’on envoie bien 5 si l’utilisateur est “5 jours”
    if (process.env.NODE_ENV !== "production") {
      console.log("[api/answers] email:", email);
      console.log("[api/answers] sessions.length:", sessions?.length);
      console.log("[api/answers] titles:", sessions?.map((s) => s.title));
    }

    return NextResponse.json({ answers, profile, sessions }, { status: 200 });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api/answers] error:", err);
    }
    return NextResponse.json(
      { answers: null, profile: null, sessions: [] },
      { status: 200 }
    );
  }
}

