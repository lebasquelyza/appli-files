// apps/web/app/api/programme/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { planProgrammeFromEmail } from "../../../lib/coach/beton";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = String(
      searchParams.get("email") || cookies().get("app_email")?.value || ""
    ).trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ sessions: [], error: "Aucun email." }, { status: 200 });
    }

    // Génération IA côté serveur depuis le Sheet
    const { sessions } = await planProgrammeFromEmail(email, { /* tu peux forcer maxSessions ici si besoin */ });
    return NextResponse.json({ sessions }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ sessions: [], error: "Programme indisponible." }, { status: 200 });
  }
}

