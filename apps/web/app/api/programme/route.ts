// apps/web/app/api/programme/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAnswersForEmail, buildProfileFromAnswers, generateProgrammeFromAnswers } from "../../../lib/coach/ai";

export const runtime = "nodejs";

type AiProgramme = { sessions: any[]; profile?: any | null };

/** Petite aide locale : reconstitue availabilityText depuis les réponses
 *  (détection chiffres 1–7, “x/fois/jours”, jours nommés, week-end, etc.)
 *  Note: on garde ce helper au cas où, mais la génération principale
 *  passe maintenant par `generateProgrammeFromAnswers`, qui lit déjà
 *  la colonne Jours/Semaine et clamp à 1..6.
 */
function availabilityFromAnswers(answers: Record<string, any> | null | undefined): string | undefined {
  if (!answers) return undefined;

  const dayPat =
    /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|week\s*-?\s*end|weekend|jours?\s+par\s+semaine|\b[1-7]\s*(x|fois|jours?)?)/i;

  const candidates: string[] = [];
  for (const k of ["daysPerWeek", "jours", "séances/semaine", "seances/semaine", "col_I"]) {
    const v = answers[k as keyof typeof answers];
    if (typeof v === "string" || typeof v === "number") candidates.push(String(v));
  }
  for (const k of Object.keys(answers)) {
    const v = (answers as any)[k];
    if (typeof v === "string" || typeof v === "number") candidates.push(String(v));
  }

  const hits = candidates
    .map((v) => String(v ?? "").trim())
    .filter((v) => v && dayPat.test(v));

  return hits.length ? hits.join(" ; ") : undefined;
}

/* ===================== GET ===================== */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const autogen = searchParams.get("autogen") === "1";
    const email = String(
      searchParams.get("email") || cookies().get("app_email")?.value || ""
    )
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json(
        { sessions: [], profile: null } satisfies AiProgramme,
        { status: 200 }
      );
    }

    if (autogen) {
      // Lecture dernière réponse + génération fiable via generateProgrammeFromAnswers (cap 1..6)
      const answers = await getAnswersForEmail(email, { fresh: true } as any);
      if (!answers) {
        return NextResponse.json(
          { sessions: [], profile: { email } } satisfies AiProgramme,
          { status: 200 }
        );
      }
      const { sessions } = generateProgrammeFromAnswers(answers);
      const profile = buildProfileFromAnswers(answers) as any;
      profile.availabilityText = availabilityFromAnswers(answers);
      return NextResponse.json(
        { sessions, profile } satisfies AiProgramme,
        { status: 200 }
      );
    }

    return NextResponse.json(
      { sessions: [], profile: null } satisfies AiProgramme,
      { status: 200 }
    );
  } catch (err) {
    console.error("[API /programme GET] ERREUR:", err);
    const safe: AiProgramme = { sessions: [], profile: null };
    return NextResponse.json(safe, { status: 200 });
  }
}

/* ===================== POST ===================== */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || cookies().get("app_email")?.value || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json({ ok: false, error: "NO_EMAIL" }, { status: 400 });
    }

    if (body.autogen) {
      const answers = await getAnswersForEmail(email, { fresh: true } as any);
      if (!answers) {
        return NextResponse.json(
          { ok: true, programme: { sessions: [], profile: { email } } },
          { status: 200 }
        );
      }
      const { sessions } = generateProgrammeFromAnswers(answers);
      const profile = buildProfileFromAnswers(answers) as any;
      profile.availabilityText = availabilityFromAnswers(answers);
      return NextResponse.json({ ok: true, programme: { sessions, profile } }, { status: 200 });
    }

    if (body.answers) {
      // Si on reçoit déjà la ligne du Sheet, on s’appuie aussi sur generateProgrammeFromAnswers
      const answers = body.answers as Record<string, any>;
      const { sessions } = generateProgrammeFromAnswers(answers);
      const profile = buildProfileFromAnswers(answers) as any;
      profile.availabilityText = availabilityFromAnswers(answers);
      return NextResponse.json({ ok: true, programme: { sessions, profile } }, { status: 200 });
    }

    if (body.programme) {
      const programme = body.programme as AiProgramme;
      return NextResponse.json({ ok: true, programme }, { status: 200 });
    }

    // Fallback : on tente une génération standard depuis la dernière réponse
    const answers = await getAnswersForEmail(email, { fresh: true } as any);
    if (answers) {
      const { sessions } = generateProgrammeFromAnswers(answers);
      const profile = buildProfileFromAnswers(answers) as any;
      profile.availabilityText = availabilityFromAnswers(answers);
      return NextResponse.json({ ok: true, programme: { sessions, profile } }, { status: 200 });
    }

    const p = buildProfileFromAnswers({ email } as any);
    return NextResponse.json({ ok: true, programme: { sessions: [], profile: p } }, { status: 200 });
  } catch (err) {
    console.error("[API /programme POST] ERREUR:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL" }, { status: 200 });
  }
}
