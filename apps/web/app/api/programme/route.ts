// apps/web/app/api/programme/route.ts — MAJ pour respecter la logique
// "1 jour = 1 séance", "week-end = 2", "6x/6 jours = 6", etc.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { planProgrammeFromProfile } from "../../../lib/coach/beton";


import {
  getAnswersForEmail, // on le garde pour POST (quand answers déjà connus) et pour fallback
  buildProfileFromAnswers,
} from "../../../lib/coach/ai";

export const runtime = "nodejs";

type AiProgramme = { sessions: any[]; profile?: any | null };

/* ===================== GET =====================
Supporte:
- ?email=... : renvoie un programme
- ?autogen=1 : force la génération depuis la **dernière** réponse du Sheet en appliquant la logique
================================================= */
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
      // Objet vide mais valide
      return NextResponse.json({ sessions: [], profile: null } satisfies AiProgramme, { status: 200 });
    }

    if (autogen) {
      // ⚙️ Génère depuis la DERNIÈRE ligne du Sheet **avec** la logique jours→séances
      const { sessions, profile } = await planProgrammeFromEmail(email, {});
      return NextResponse.json({ sessions, profile } satisfies AiProgramme, { status: 200 });
    }

    // Pas d'autogen → renvoi “vide” (placeholder). Tu peux brancher une persistance ici si besoin.
    return NextResponse.json({ sessions: [], profile: null } satisfies AiProgramme, { status: 200 });
  } catch (err) {
    console.error("[API /programme GET] ERREUR:", err);
    const safe: AiProgramme = { sessions: [], profile: null };
    return NextResponse.json(safe, { status: 200 });
  }
}

/* ===================== POST =====================
Body:
- { email, autogen: true } → génère depuis la DERNIÈRE réponse (comme GET autogen),
  en appliquant la logique jours→séances.
- { email, answers }       → (optionnel) si tu as déjà les réponses (batch),
  on évite un call sheet et on applique la même logique.
- { email, programme }     → renvoie tel quel (placeholder persistance)
================================================= */
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
      // Même logique que GET autogen, mais on renvoie ok:true
      const { sessions, profile } = await planProgrammeFromEmail(email, {});
      return NextResponse.json({ ok: true, programme: { sessions, profile } }, { status: 200 });
    }

    if (body.answers) {
      // Si le client t'envoie déjà l'objet answers → pas besoin d'appeler le Sheet
      const { sessions, profile } = planProgrammeFromAnswers(body.answers, {});
      return NextResponse.json({ ok: true, programme: { sessions, profile } }, { status: 200 });
    }

    if (body.programme) {
      // Ici tu peux persister (DB/Redis/FS) si tu ajoutes un stockage.
      const programme = body.programme as AiProgramme;
      return NextResponse.json({ ok: true, programme }, { status: 200 });
    }

    // Fallback: si rien n'est fourni, on tente quand même de générer depuis le Sheet (ancienne habitude)
    const answers = await getAnswersForEmail(email);
    if (answers) {
      const { sessions, profile } = planProgrammeFromAnswers(answers, {});
      return NextResponse.json({ ok: true, programme: { sessions, profile } }, { status: 200 });
    }

    // Rien trouvé → profil minimal
    const p = buildProfileFromAnswers({ email } as any);
    return NextResponse.json({ ok: true, programme: { sessions: [], profile: p } }, { status: 200 });
  } catch (err) {
    console.error("[API /programme POST] ERREUR:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL" }, { status: 200 });
  }
}
