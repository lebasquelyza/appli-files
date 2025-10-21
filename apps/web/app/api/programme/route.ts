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

/* ===================== GET =====================
Supporte:
- ?email=... : charge le programme sauvegardé (si dispo)
- ?autogen=1&email=... : génère à la volée depuis les réponses (sans persister)
================================================= */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = (searchParams.get("email") || cookies().get("app_email")?.value || "").trim().toLowerCase();
    const autogen = searchParams.get("autogen") === "1";

    if (!email) {
      return NextResponse.json({ sessions: [], profile: null }, { status: 200 });
    }

    if (autogen) {
      const answers = await getAnswersForEmail(email);
      if (!answers) {
        // Pas de réponses → retour neutre (pas de 500)
        return NextResponse.json({ sessions: [], profile: buildProfileFromAnswers({ email }) }, { status: 200 });
      }
      const prog = generateProgrammeFromAnswers(answers);
      return NextResponse.json(prog, { status: 200 });
    }

    // lecture "persistée" (noop en edge si pas de fs)
    const saved = await loadProgrammeForUser(email);
    if (!saved?.programme) {
      return NextResponse.json({ sessions: [], profile: null }, { status: 200 });
    }
    return NextResponse.json(saved.programme, { status: 200 });
  } catch (err) {
    console.error("[API /programme GET] ERREUR :", err);
    return NextResponse.json({ sessions: [], profile: null }, { status: 200 });
  }
}

/* ===================== POST =====================
Body:
- { email, autogen: true }  → génère depuis réponses et (optionnel) persiste
- { email, programme }      → persiste tel quel
================================================= */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || cookies().get("app_email")?.value || "").trim().toLowerCase();
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
    } else if (body.programme) {
      programme = body.programme as AiProgramme;
    } else {
      return NextResponse.json({ ok: false, error: "NO_PROGRAMME" }, { status: 400 });
    }

    // Persistance best-effort (noop si edge)
    await saveProgrammeForUser(email, programme);

    return NextResponse.json({ ok: true, programme }, { status: 200 });
  } catch (err) {
    console.error("[API /programme POST] ERREUR :", err);
    // On évite de renvoyer 500 aux pages qui attendent un JSON toujours valide
    return NextResponse.json({ ok: false, error: "INTERNAL" }, { status: 200 });
  }
}

