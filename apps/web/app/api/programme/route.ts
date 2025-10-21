// apps/web/app/api/programme/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAnswersForEmail,
  generateProgrammeFromAnswers,
  buildProfileFromAnswers,
  type AiProgramme,
} from "../../../lib/coach/ai";

export const runtime = "nodejs";

/* ===================== GET =====================
Supporte:
- ?email=... : renvoie un programme (si autogen=1, il est généré depuis les dernières réponses)
- ?autogen=1  : force la génération depuis les réponses (Sheets) pour cet email
================================================= */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const autogen = searchParams.get("autogen") === "1";
    const email =
      (searchParams.get("email") || cookies().get("app_email")?.value || "")
        .trim()
        .toLowerCase();

    if (!email) {
      // On renvoie un objet vide mais valide (pas d’exception)
      return NextResponse.json({ sessions: [], profile: null }, { status: 200 });
    }

    if (autogen) {
      // 🔁 Toujours repartir des DERNIÈRES réponses associées à cet email
      const answers = await getAnswersForEmail(email);
      if (!answers) {
        // Rien trouvé dans Sheets → profil minimal + 0 séance
        const p = buildProfileFromAnswers({ email } as any);
        return NextResponse.json({ sessions: [], profile: p }, { status: 200 });
      }
      const prog = generateProgrammeFromAnswers(answers); // ← IA sur les dernières réponses
      return NextResponse.json(prog, { status: 200 });
    }

    // Si pas autogen, on reste safe et renvoie un objet vide (tu pourras ajouter une persistance plus tard)
    return NextResponse.json({ sessions: [], profile: null }, { status: 200 });
  } catch (err) {
    console.error("[API /programme GET] ERREUR :", err);
    return NextResponse.json({ sessions: [], profile: null }, { status: 200 });
  }
}

/* ===================== POST =====================
Body:
- { email, autogen: true } → génère à partir des dernières réponses (comme GET autogen)
- { email, programme }     → persiste (optionnel, à implémenter plus tard si besoin)
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

    let programme: AiProgramme | null = null;

    if (body.autogen) {
      const answers = await getAnswersForEmail(email);
      if (!answers) {
        const p = buildProfileFromAnswers({ email } as any);
        return NextResponse.json({ ok: true, programme: { sessions: [], profile: p } }, { status: 200 });
      }
      programme = generateProgrammeFromAnswers(answers);
      return NextResponse.json({ ok: true, programme }, { status: 200 });
    }

    if (body.programme) {
      // Ici tu pourrais persister si tu ajoutes un stockage (Redis/FS/DB).
      programme = body.programme as AiProgramme;
      return NextResponse.json({ ok: true, programme }, { status: 200 });
    }

    return NextResponse.json({ ok: false, error: "NO_PROGRAMME" }, { status: 400 });
  } catch (err) {
    console.error("[API /programme POST] ERREUR :", err);
    return NextResponse.json({ ok: false, error: "INTERNAL" }, { status: 200 });
  }
}


