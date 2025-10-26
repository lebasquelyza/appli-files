// apps/web/app/api/answers/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAnswersForEmail, buildProfileFromAnswers } from "../../../lib/coach/ai";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = String(
      searchParams.get("email") || cookies().get("app_email")?.value || ""
    ).trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ answers: null, profile: null }, { status: 200 });
    }

    // ✅ Récupère toujours la dernière ligne du Sheet
    const answers = await getAnswersForEmail(email, { fresh: true } as any);
    if (!answers) {
      return NextResponse.json({ answers: null, profile: { email } }, { status: 200 });
    }

    // ✅ Profil construit avec TA logique existante (inchangée)
    const profile = buildProfileFromAnswers(answers);
    return NextResponse.json({ answers, profile }, { status: 200 });
  } catch {
    return NextResponse.json({ answers: null, profile: null }, { status: 200 });
  }
}
