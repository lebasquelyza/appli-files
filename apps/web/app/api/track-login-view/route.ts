import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[track-login-view] SUPABASE env vars manquants");
      return NextResponse.json(
        { error: "Supabase env vars missing" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({} as any));
    const rawPath = body.path ?? "/";
    const rawEmail = body.email ?? null;

    const path = String(rawPath || "/");
    const email =
      rawEmail && String(rawEmail).trim()
        ? String(rawEmail).trim().toLowerCase()
        : null;

    const { data, error } = await supabaseAdmin
      .from("auth_events")
      .insert({
        event_name: "LOGIN_PAGE_VIEW",
        email,
        metadata: {
          path,
        },
      })
      .select("id, created_at, email, event_name")
      .single();

    if (error) {
      console.error("[track-login-view] insert error:", error);
      return NextResponse.json(
        { error: "DB insert error", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, inserted: data }, { status: 200 });
  } catch (e: any) {
    console.error("[track-login-view] fatal:", e);
    return NextResponse.json(
      { ok: false, message: "Erreur interne.", details: e?.message },
      { status: 500 }
    );
  }
}
