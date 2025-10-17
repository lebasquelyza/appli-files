// apps/web/app/api/programme/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAnswersForEmail,
  generateProgrammeFromAnswers,
  buildProfileFromAnswers,
  type AiProgramme,
  type Profile,
} from "../../../lib/coach/ai";

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

/* ===================== GET ===================== */
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

    // 2) Autogen si demandé et vide
    if (
      autogen &&
      (!programme || !Array.isArray(programme.sessions) || programme.sessions.length === 0)
    ) {
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

        // ✅ construit le profil + programme
        const profile: Profile = buildProfileFromAnswers(answers);
        const prog = generateProgrammeFromAnswers(answers); // { sessions }
        programme = { sessions: prog.sessions, profile };

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

/* ===================== POST ===================== */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const user = String(body.user || cookies().get("fc_uid")?.value || "me");
    const sessions = Array.isArray(body.sessions) ? body.sessions : [];
    const profile = (body.profile || null) as Profile | null;

    if (!sessions.length) {
      return NextResponse.json({ ok: false, error: "NO_SESSIONS" }, { status: 400 });
    }

    const programme: AiProgramme = profile ? { sessions, profile } : { sessions };
    await redisSetJSON(keyForUser(user), programme);

    return NextResponse.json({ ok: true, user, count: sessions.length }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "WRITE_FAILED", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
