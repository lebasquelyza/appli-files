// apps/web/app/api/programme/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAnswersForEmail,
  generateProgrammeFromAnswers,
  type AiProgramme,
} from "@/app/lib/coach/ai";

export const runtime = "nodejs";

const R_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const R_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

/** Upstash REST */
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

async function redisGet(key: string): Promise<string | null> {
  const v = await redisCmd(["GET", key]);
  return typeof v === "string" ? v : null;
}
async function redisSet(key: string, value: string, ttlSeconds?: number) {
  if (typeof ttlSeconds === "number" && ttlSeconds > 0) {
    return await redisCmd(["SET", key, value, "EX", ttlSeconds]);
  }
  return await redisCmd(["SET", key, value]);
}

/** Clés Redis */
const keyForUser = (user: string) => `fc:program:${user}`;
const keyAutogenAt = (user: string) => `fc:autogen_at:${user}`;

/** 30 jours en secondes */
const THIRTY_DAYS_S = 30 * 24 * 60 * 60;

/* ===================== GET ===================== */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const user = searchParams.get("user") || cookies().get("fc_uid")?.value || "me";
    const autogen = searchParams.get("autogen") === "1";
    const ttl = Number(searchParams.get("ttl")) || 0; // TTL optionnel pour la persistance du programme
    const emailQP = searchParams.get("email") || "";
    const emailCookie = cookies().get("app_email")?.value || "";
    const email = emailQP || emailCookie;

    // 1) Lecture programme existant
    let programme = await redisGetJSON<AiProgramme>(keyForUser(user));

    // 2) Autogen conditionnel (et limité à 1/mois)
    if ((!programme || !Array.isArray(programme.sessions) || programme.sessions.length === 0) && autogen) {
      // Check rate-limit (1 par 30 jours par user)
      const last = await redisGet(keyAutogenAt(user));
      if (last) {
        const lastMs = Date.parse(last);
        if (!Number.isNaN(lastMs)) {
          const diffMs = Date.now() - lastMs;
          if (diffMs < THIRTY_DAYS_S * 1000) {
            const retryAt = new Date(lastMs + THIRTY_DAYS_S * 1000);
            return NextResponse.json(
              {
                ok: false,
                error: "RATE_LIMITED",
                message: "Limite: 1 génération par mois.",
                retryAt: retryAt.toISOString(),
              },
              { status: 429 }
            );
          }
        }
      }

      // On a le droit de (re)générer
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
        // tamponne la date de génération (pas d’expiration pour conserver l’historique)
        await redisSet(keyAutogenAt(user), new Date().toISOString());
      } catch (e: any) {
        return NextResponse.json(
          { ok: false, error: "AUTOGEN_FAILED", message: String(e?.message || e) },
          { status: 500 }
        );
      }
    }

    // 3) Réponse
    return NextResponse.json(programme ?? { sessions: [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { sessions: [], error: "READ_FAILED", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

/* ===================== POST =====================
  Écrit un programme côté Redis.
  Body attendu:
  {
    "user": "user-id-opaque",
    "sessions": [ ... ] // même forme que AiProgramme.sessions
  }
  ⚠️ Pas de rate-limit ici : c’est pour une écriture explicite depuis ton back-office/admin.
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
