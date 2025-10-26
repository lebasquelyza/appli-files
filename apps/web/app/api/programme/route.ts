// apps/web/app/api/programme/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { planProgrammeFromEmail } from "../../../lib/coach/beton";
import { getAnswersForEmail, buildProfileFromAnswers } from "../../../lib/coach/ai";

export const runtime = "nodejs";

type AiProgramme = { sessions: any[]; profile?: any | null };

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
  const hits = candidates.map(v => String(v ?? "").trim()).filter(v => v && dayPat.test(v));
  return hits.length ? hits.join(" ; ") : undefined;
}

/** Helper: génère depuis l'email en privilégiant la DERNIÈRE réponse du Sheet */
async function generateFromEmail(email: string, { fresh = true, today }: { fresh?: boolean; today?: Date } = {}) {
  // Option 1 (recommandé): s’appuyer sur planProgrammeFromEmail pour tout faire
  const { sessions, profile } = await planProgrammeFromEmail(email, { today });

  // Option 2 (si tu veux injecter availabilityText custom) :
  // const answers = await getAnswersForEmail(email, { fresh });
  // if (!answers) return { sessions: [], profile: { email } };
  // const profile = buildProfileFromAnswers(answers) as any;
  // profile.availabilityText = availabilityFromAnswers(answers);
  // const { sessions } = planProgrammeFromProfile(profile, { today });
  // return { sessions, profile };

  return { sessions, profile };
}

/* ===================== GET ===================== */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const autogen = searchParams.get("autogen") === "1";
    const email = String(searchParams.get("email") || cookies().get("app_email")?.value || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json({ sessions: [], profile: null } satisfies AiProgramme, { status: 200 });
    }

    if (autogen) {
      const { sessions, profile } = await generateFromEmail(email, {
        fresh: true,
        // today: new Date() // tu peux forcer la TZ/Date ici si besoin
      });
      return NextResponse.json({ sessions, profile } satisfies AiProgramme, { status: 200 });
    }

    return NextResponse.json({ sessions: [], profile: null } satisfies AiProgramme, { status: 200 });
  } catch (err) {
    console.error("[API /programme GET] ERREUR:", err);
    return NextResponse.json({ sessions: [], profile: null } satisfies AiProgramme, { status: 200 });
  }
}

/* ===================== POST ===================== */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || cookies().get("app_email")?.value || "").trim().toLowerCase();
    const autogen = !!body.autogen;

    if (!email) {
      return NextResponse.json({ ok: false, error: "NO_EMAIL" }, { status: 400 });
    }

    if (autogen) {
      const { sessions, profile } = await generateFromEmail(email, { fresh: true });
      return NextResponse.json({ ok: true, programme: { sessions, profile } }, { status: 200 });
    }

    if (body.answers) {
      // Si tu reçois déjà la ligne du Sheet
      const answers = body.answers as Record<string, any>;
      const profile = buildProfileFromAnswers(answers) as any;
      profile.availabilityText = availabilityFromAnswers(answers);
      // Ici on appelle directement beton
      const { planProgrammeFromProfile } = await import("../../../lib/coach/beton");
      const { sessions } = planProgrammeFromProfile(profile);
      return NextResponse.json({ ok: true, programme: { sessions, profile } }, { status: 200 });
    }

    if (body.programme) {
      return NextResponse.json({ ok: true, programme: body.programme as AiProgramme }, { status: 200 });
    }

    // Fallback: dernière réponse (fresh) par défaut
    const { sessions, profile } = await generateFromEmail(email, { fresh: true });
    return NextResponse.json({ ok: true, programme: { sessions, profile } }, { status: 200 });
  } catch (err) {
    console.error("[API /programme POST] ERREUR:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL" }, { status: 200 });
  }
}

