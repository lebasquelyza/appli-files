// apps/web/app/api/programme/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAnswersForEmail,
  generateProgrammeFromAnswers,
  buildProfileFromAnswers,
  getAiSessions,
  saveProgrammeForUser,
  loadProgrammeForUser,
  generateNextWeekForUser,
  type AiProgramme,
} from "../../../lib/coach/ai";

export const runtime = "nodejs";

/* ===================== GET ===================== */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = (searchParams.get("email") || cookies().get("app_email")?.value || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ sessions: [], profile: null }, { status: 200 });
    }

    const programme = await loadProgrammeForUser(email);
    if (!programme) {
      return NextResponse.json({ sessions: [], profile: null }, { status: 200 });
    }

    return NextResponse.json(programme.programme, { status: 200 });
  } catch (err) {
    console.error("[API /programme GET] ERREUR :", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

/* ===================== POST ===================== */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || cookies().get("app_email")?.value || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ ok: false, error: "NO_EMAIL" }, { status: 400 });
    }

    let programme: AiProgramme;

    if (body.autogen) {
      const answers = await getAnswersForEmail(email);
      if (!answers) {
        return NextResponse.json({ ok: false, error: "NO_ANSWERS" }, { status: 404 });
      }
      programme = generateProgrammeFromAnswers(answers);
    } else {
      programme = body.programme;
    }

    await saveProgrammeForUser(email, programme);
    return NextResponse.json({ ok: true, programme }, { status: 200 });
  } catch (err) {
    console.error("[API /programme POST] ERREUR :", err);
    return NextResponse.json({ ok: false, error: "Erreur interne" }, { status: 500 });
  }
}
