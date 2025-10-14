// app/api/programme/build/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";

/** Facultatif: si tu veux du streaming edge, enlève ce runtime.
 * On force Node.js car le SDK OpenAI a besoin d'un env Node.
 */
export const runtime = "nodejs";

/* ===================== Schéma de données ===================== */
const ExerciseSchema = z.object({
  name: z.string(),
  sets: z.number().optional(),
  reps: z.union([z.string(), z.number()]).optional(),
  rest: z.string().optional(),
  durationSec: z.number().optional(),
  notes: z.string().optional(),
  tempo: z.string().optional(),
  rir: z.number().optional(),
  load: z.string().optional(),
  equipment: z.string().optional(),
  target: z.union([z.string(), z.array(z.string())]).optional(),
  alt: z.string().optional(),
  videoUrl: z.string().url().optional(),
  block: z.enum(["echauffement", "principal", "fin", "accessoires"]).optional(),
});

const SessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["muscu", "cardio", "hiit", "mobilité"]),
  date: z.string(), // YYYY-MM-DD
  plannedMin: z.number().optional(),
  intensity: z.enum(["faible", "modérée", "élevée"]).optional(),
  note: z.string().optional(),
  exercises: z.array(ExerciseSchema).optional(),
});

const ProgrammeSchema = z.object({
  sessions: z.array(SessionSchema).min(1),
});

/* ===================== Stockage (Upstash Redis REST) ===================== */
const R_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const R_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

/** Exécute une commande Redis REST Upstash */
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
async function redisSetJSON(key: string, value: unknown) {
  if (!R_URL || !R_TOKEN) return;
  await redisCmd(["SET", key, JSON.stringify(value)]);
}

/* ===================== Helpers ===================== */
function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function s(v: unknown) { return typeof v === "string" ? v : v == null ? "" : String(v); }

/* ===================== Prompt IA ===================== */
function buildPrompt({
  answers,
  email,
  aiBrief,
}: {
  answers?: Record<string, unknown> | null;
  email?: string | null;
  aiBrief?: any;
}) {
  const brief = aiBrief || {};
  return [
    {
      role: "system" as const,
      content:
        "Tu es Coach Files, un coach sportif IA. Génère des programmes très détaillés en FR, adaptés au profil utilisateur et au matériel disponible.",
    },
    {
      role: "user" as const,
      content:
        `Profil (dernière réponse questionnaire, email: ${email || "inconnu"}) :\n` +
        JSON.stringify(answers || {}, null, 2) +
        `\n\nExigences de sortie :\n` +
        JSON.stringify(brief, null, 2) +
        `\n\nRENVOIE UNIQUEMENT un JSON valide correspondant EXACTEMENT à ce schéma (sans texte autour) :\n` +
        JSON.stringify(
          {
            sessions: [
              {
                id: "string",
                title: "string",
                type: "muscu|cardio|hiit|mobilité",
                date: "YYYY-MM-DD",
                plannedMin: 30,
                intensity: "faible|modérée|élevée",
                note: "string",
                exercises: [
                  {
                    name: "string",
                    sets: 3,
                    reps: "8–12",
                    rest: "60–90s",
                    tempo: "3-1-1",
                    rir: 2,
                    load: "RPE 8 ou 20kg ou 75%1RM",
                    equipment: "haltères, banc",
                    target: "pectoraux, triceps",
                    alt: "pompes au sol",
                    videoUrl: "https://...",
                    block: "echauffement|principal|accessoires|fin",
                    notes: "consignes techniques"
                  }
                ]
              }
            ]
          },
          null,
          2
        ) +
        `\n- Minimum 3 séances si possible, dates à partir d'aujourd'hui (${todayYMD()}).\n` +
        `- Chaque séance inclut échauffement, bloc principal, (option) accessoires, fin/retour au calme (via le champ "block").\n` +
        `- Respecte le matériel dispo; propose "alt" si non dispo.\n` +
        `- Ajoute des "videoUrl" pertinentes quand tu peux.\n`,
    },
  ];
}

/* ===================== Route POST ===================== */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const user = s(body.user || "me");
    const email = s(body.email || "");
    const answers = (body.answers && typeof body.answers === "object") ? body.answers : null;
    const aiBrief = body.aiBrief || null;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const messages = buildPrompt({ answers, email, aiBrief });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages,
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw.trim().replace(/^```json|```$/g, "").trim());

    const programme = ProgrammeSchema.parse(parsed);

    // Persist
    await redisSetJSON(`fc:program:${user}`, programme);

    return NextResponse.json({ ok: true, sessions: programme.sessions });
  } catch (e: any) {
    console.error("programme/build error:", e?.message || e);
    return NextResponse.json(
      { ok: false, error: "IA_BUILD_FAILED", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
