import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[track-session-created] SUPABASE env vars manquants");
      return NextResponse.json(
        { error: "Supabase env vars missing" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({} as any));
    const rawEmail = body.email ?? null;
    const sessionName = String(body.sessionName || "").trim();
    const durationMinutes = body.durationMinutes ?? null;
    const metadata = body.metadata ?? {};

    if (!sessionName) {
      return NextResponse.json(
        { error: "sessionName est requis" },
        { status: 400 }
      );
    }

    const email =
      rawEmail && String(rawEmail).trim()
        ? String(rawEmail).trim().toLowerCase()
        : null;

    let userId: string | null = null;
    if (email) {
      try {
        const { data, error } =
          await supabaseAdmin.auth.admin.listUsersByEmail(email);
        if (!error && data?.users?.[0]) {
          userId = data.users[0].id;
        }
      } catch (err) {
        console.error("[track-session-created] listUsersByEmail error:", err);
      }
    }

    const { data, error } = await supabaseAdmin
      .from("workout_sessions")
      .insert({
        session_name: sessionName,
        duration_minutes: durationMinutes,
        email,
        user_id: userId,
        metadata,
      })
      .select("id, session_name, email, created_at")
      .single();

    if (error) {
      console.error("[track-session-created] insert error:", error);
      return NextResponse.json(
        { error: "DB insert error", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, inserted: data }, { status: 200 });
  } catch (e: any) {
    console.error("[track-session-created] fatal:", e);
    return NextResponse.json(
      { ok: false, message: "Erreur interne.", details: e?.message },
      { status: 500 }
    );
  }
}
