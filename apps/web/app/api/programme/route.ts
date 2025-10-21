// apps/web/app/api/programme/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAnswersForEmail,
  generateProgrammeFromAnswers,
  buildProfileFromAnswers,
  saveProgrammeForUser,
  loadProgrammeForUser,
  generateNextWeekForUser,
  type AiProgramme,
} from "../../../lib/coach/ai";

/* ===================== GET =====================
  - Charge programme sauvegardé si dispo
  - Sinon génère depuis le questionnaire
================================================= */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const emailQP = (searchParams.get("email") || "").trim().toLowerCase();
  const emailCookie = (cookies().get("app_email")?.value || "").trim().toLowerCase();
  const email = emailQP || emailCookie;

  if (!email) {
    return NextResponse.json({ ok: false, error: "NO_EMAIL" }, { status: 400 });
  }

  // 1. Charger programme sauvegardé
  const saved = await loadProgrammeForUser(email);
  if (saved) {
    return NextResponse.json(saved.programme, { status: 200 });
  }

  // 2. Sinon générer à partir des réponses
  const answers = await getAnswersForEmail(email);
  if (!answers) {
    return NextResponse.json({ ok: false, error: "NO_ANSWERS" }, { status: 404 });
  }

  const prog = generateProgrammeFromAnswers(answers, 0);
  await saveProgrammeForUser(email, prog, 0);
  return NextResponse.json(prog, { status: 200 });
}

/* ===================== POST =====================
  - Sauvegarde programme envoyé depuis le front
================================================= */
export async function POST(req: Request) {
  const body = await req.json();
  const email = body.email || cookies().get("app_email")?.value;
  if (!email) return NextResponse.json({ ok: false, error: "NO_EMAIL" }, { status: 400 });

  const programme = body.programme as AiProgramme;
  if (!programme?.sessions?.length) {
    return NextResponse.json({ ok: false, error: "NO_SESSIONS" }, { status: 400 });
  }

  await saveProgrammeForUser(email, programme, body.week || 0);
  return NextResponse.json({ ok: true, saved: true });
}

/* ===================== PATCH =====================
  - Génère la prochaine semaine de progression
================================================= */
export async function PATCH(req: Request) {
  const body = await req.json();
  const email = body.email || cookies().get("app_email")?.value;
  if (!email) return NextResponse.json({ ok: false, error: "NO_EMAIL" }, { status: 400 });

  const answers = await getAnswersForEmail(email);
  if (!answers) return NextResponse.json({ ok: false, error: "NO_ANSWERS" }, { status: 404 });

  const prog = await generateNextWeekForUser(email, answers);
  return NextResponse.json(prog, { status: 200 });
}
