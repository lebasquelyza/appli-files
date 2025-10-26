// apps/web/app/api/programme/route.ts — corrigé
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { planProgrammeFromProfile } from "../../../lib/coach/beton";
import { getAnswersForEmail, buildProfileFromAnswers } from "../../../lib/coach/ai";

export const runtime = "nodejs";

type AiProgramme = { sessions: any[]; profile?: any | null };

/** ===== Helpers locaux (minimaux) =====
 * Ces helpers ne changent pas ta logique “Mes infos”.
 * Ils servent juste à mieux lire la dispo pour passer maxSessions à béton.
 */
const DAYS = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];

function extractDaysList(text?: string | null): string[] {
  if (!text) return [];
  const s = String(text).toLowerCase();
  const out: string[] = [];
  const push = (d: string) => { if (!out.includes(d)) out.push(d); };

  if (/week\s*-?\s*end|weekend/.test(s)) { push("samedi"); push("dimanche"); }
  for (const d of DAYS) if (new RegExp(`\\b${d}\\b`, "i").test(s)) push(d);
  return out;
}

function inferMaxSessionsFromText(text?: string | null): number | undefined {
  if (!text) return undefined;
  const s = String(text).toLowerCase();

  // “5x”, “5 fois”, “5 jours”
  const numMatch = s.match(/\b(\d{1,2})\s*(x|fois|jours?)\b/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (!Number.isNaN(n)) return Math.max(1, Math.min(6, n));
  }

  // “toute la semaine”, “tous les jours”
  if (/toute?\s+la\s+semaine|tous?\s+les\s+jours/.test(s)) return 6;

  // Liste de jours (“lundi mardi …” / “week-end”)
  const days = extractDaysList(s);
  if (days.length) return Math.max(1, Math.min(6, days.length));

  return undefined;
}

/** Petite aide locale : reconstitue availabilityText depuis les réponses
 * (détection chiffres 1–7, “x/fois/jours”, jours nommés, week-end, etc.)
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
      // On lit la dernière ligne du Sheet, on construit un profil,
      // on y ajoute availabilityText (avec détection des chiffres),
      // puis on génère les séances.
      const answers = await getAnswersForEmail(email, { fresh: true } as any);
      if (!answers) {
        return NextResponse.json(
          { sessions: [], profile: { email } } satisfies AiProgramme,
          { status: 200 }
        );
      }
      const profile = buildProfileFromAnswers(answers) as any;
      profile.availabilityText = availabilityFromAnswers(answers);

      // 🔧 NOUVEAU (minime) : passer maxSessions explicite à béton
      const maxSessions = inferMaxSessionsFromText(profile.availabilityText) ?? 3;

      const { sessions } = planProgrammeFromProfile(profile, { maxSessions });

      return NextResponse.json({ sessions, profile } satisfies AiProgramme, { status: 200 });
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
      const profile = buildProfileFromAnswers(answers) as any;
      profile.availabilityText = availabilityFromAnswers(answers);

      // 🔧 NOUVEAU (minime) : passer maxSessions explicite à béton
      const maxSessions = inferMaxSessionsFromText(profile.availabilityText) ?? 3;

      const { sessions } = planProgrammeFromProfile(profile, { maxSessions });
      return NextResponse.json({ ok: true, programme: { sessions, profile } }, { status: 200 });
    }

    if (body.answers) {
      // Si on reçoit déjà les réponses, même traitement local
      const answers = body.answers as Record<string, any>;
      const profile = buildProfileFromAnswers(answers) as any;
      profile.availabilityText = availabilityFromAnswers(answers);

      // 🔧 NOUVEAU (minime) : passer maxSessions explicite à béton
      const maxSessions = inferMaxSessionsFromText(profile.availabilityText) ?? 3;

      const { sessions } = planProgrammeFromProfile(profile, { maxSessions });
      return NextResponse.json({ ok: true, programme: { sessions, profile } }, { status: 200 });
    }

    if (body.programme) {
      const programme = body.programme as AiProgramme;
      return NextResponse.json({ ok: true, programme }, { status: 200 });
    }

    // Fallback : on tente une génération standard à partir du Sheet
    const answers = await getAnswersForEmail(email);
    if (answers) {
      const profile = buildProfileFromAnswers(answers) as any;
      profile.availabilityText = availabilityFromAnswers(answers);

      // 🔧 NOUVEAU (minime) : passer maxSessions explicite à béton
      const maxSessions = inferMaxSessionsFromText(profile.availabilityText) ?? 3;

      const { sessions } = planProgrammeFromProfile(profile, { maxSessions });
      return NextResponse.json({ ok: true, programme: { sessions, profile } }, { status: 200 });
    }

    const p = buildProfileFromAnswers({ email } as any);
    return NextResponse.json({ ok: true, programme: { sessions: [], profile: p } }, { status: 200 });
  } catch (err) {
    console.error("[API /programme POST] ERREUR:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL" }, { status: 200 });
  }
}
