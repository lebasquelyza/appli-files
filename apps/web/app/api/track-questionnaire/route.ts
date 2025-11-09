import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findUserIdByEmail(supabaseAdmin: any, email: string): Promise<string | null> {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", normalized)
      .single();

    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

/** POST /api/track-questionnaire
 * body: { questionnaireKey: string, email?: string, answers: any }
 */
export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[track-questionnaire] SUPABASE env vars manquants");
      return NextResponse.json(
        { error: "Supabase env vars missing" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({} as any));
    const questionnaireKey = String(body.questionnaireKey || "").trim();
    const rawEmail = body.email ?? null;
    const answers = body.answers;

    if (!questionnaireKey || !answers) {
      return NextResponse.json(
        { error: "questionnaireKey et answers sont requis" },
        { status: 400 }
      );
    }

    const email =
      rawEmail && String(rawEmail).trim()
        ? String(rawEmail).trim().toLowerCase()
        : null;

    let userId: string | null = null;
    if (email) {
      userId = await findUserIdByEmail(supabaseAdmin, email);
    }

    const { data, error } = await supabaseAdmin
      .from("questionnaire_responses")
      .insert({
        questionnaire_key: questionnaireKey,
        email,
        user_id: userId,
        answers: answers, // JSON brut
      })
      .select("id, questionnaire_key, email, created_at")
      .single();

    if (error) {
      console.error("[track-questionnaire] insert error:", error);
      return NextResponse.json(
        { error: "DB insert error", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, inserted: data }, { status: 200 });
  } catch (e: any) {
    console.error("[track-questionnaire] fatal:", e);
    return NextResponse.json(
      { ok: false, message: "Erreur interne.", details: e?.message },
      { status: 500 }
    );
  }
}
