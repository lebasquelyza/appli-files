// apps/web/app/api/programme/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
// ⚠️ Import RELATIF vers la lib AI
import {
  getAnswersForEmail,
  generateProgrammeFromAnswers,
  type AiProgramme,
} from "../../../lib/coach/ai.ts";

export const runtime = "nodejs";

const R_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const R_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

/** Upstash REST helper */
async function redisCmd(command: (string | number)[]) {
  if (!R_URL || !R_TOKEN) return null;
  const res = await fetch(R_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${R_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ command }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return json?.result ?? null;
}

async function redisGetJSON<T = any>(key: string): Promise<T | null> {
  const str = await redisCmd(["GET", key]);
  if (!str || typeof str !== "string") return null;
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

async function redisSetJSON(key: string, value: any, ttlSeconds?: number) {
  const payload = JSON.stringify(value);
  if (typeof ttlSeconds === "number" && ttlSeconds > 0) {
    return await redisCmd(["SET", key, payload, "EX", ttlSeconds]);
  }
  return await redisCmd(["SET", key, payload]);
}

/** Clé Redis */
const keyForUser = (user: string) => `fc:program:${user}`;

/* ===================== GET =====================
   Lit le programme depuis Redis.
   Si `autogen=1` ET que le programme est vide : génère depuis Sheets et écrit en Redis.
   Params:
     - user: id opaque (par défaut cookie fc_uid ou "me")
     - autogen=1: active l’auto-génération si vide
     - email: email pour chercher les réponses dans Sheets (fallback: cookie app_email)
     - ttl: TTL en secondes optionnel pour la clé Redis
================================================= */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const user = searchParams.get("user") || cookies().get("fc_uid")?.value || "me";
    const autogen = searchParams.get("autogen") === "1";
    const ttl = Number(searchParams.get("ttl")) || 0;
    const emailQP = searchParams.get("email") || "";
    const emailCookie = cookies().get("app_email")?.value || "";
    const email = emailQP || emailCookie;

    // 1) Lecture Redis
    let programme = await redisGetJSON<AiProgramme>(keyForUser(user));

    // 2) Autogen si demandé et vide (AUCUNE LIMITE MENSUELLE)
    if ((!programme || !Array.isArray(programme.sessions) || programme.sessions.length === 0) && autogen) {
      if (!email) {
        return NextResponse.json(
          { ok: false, error: "NO_EMAIL", message: "Email requis pour générer le programme." },
          { status: 400 }
        );
      }
      try {
        const answers = await getAnswersForEmail(email);
        if (!answers) {
          return NextResponse.json(
            { ok: false, error: "NO_SHEETS_ANSWERS", message: "Aucune réponse de questionnaire trouvée." },
            { status: 404 }
          );
        }
        const sessions = generateProgrammeFromAnswers(answers);
        programme = { sessions };
        await redisSetJSON(keyForUser(user), programme, ttl > 0 ? ttl : undefined);
      } catch (e: any) {
        return NextResponse.json(
          { ok: false, error: "AUTOGEN_FAILED", message: String(e?.message || e) },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(programme ?? { sessions: [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { sessions: [], error: "READ_FAILED", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

/* ===================== POST =====================
  Écrit un programme côté Redis tel quel (sans autogen).
  Body attendu:
  {
    "user": "user-id-opaque",
    "sessions": [ ... ] // même forme que AiProgramme.sessions
  }
=================================================== */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const user = String(body.user || cookies().get("fc_uid")?.value || "me");
    const sessions = Array.isArray(body.sessions) ? body.sessions : [];

    if (!sessions.length) {
      return NextResponse.json({ ok: false, error: "NO_SESSIONS" }, { status: 400 });
    }

    const programme: AiProgramme = { sessions };
    await redisSetJSON(keyForUser(user), programme);

    return NextResponse.json({ ok: true, user, count: sessions.length }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "WRITE_FAILED", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

