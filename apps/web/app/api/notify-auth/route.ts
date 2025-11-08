import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Client Supabase admin (service_role) côté serveur
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/**
 * POST /api/notify-auth
 * body: { type: "login" | "signup", userEmail: string }
 */
export async function POST(req: Request) {
  try {
    const { type, userEmail } = await req.json();

    const typeStr = String(type || "").trim();
    const emailTrim = String(userEmail || "").trim().toLowerCase();

    if (!typeStr || !emailTrim) {
      return NextResponse.json(
        { error: "Type et email requis" },
        { status: 400 }
      );
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Supabase env vars missing" },
        { status: 500 }
      );
    }

    const isLogin = typeStr === "login";
    const isSignup = typeStr === "signup";

    const eventName = isLogin
      ? "LOGIN"
      : isSignup
      ? "SIGN_UP"
      : typeStr.toUpperCase();

    const { data, error } = await supabaseAdmin
      .from("auth_events")
      .insert({
        event_name: eventName,
        email: emailTrim,
        metadata: {
          source: "notify-auth-minimal",
          raw_type: typeStr,
        },
      })
      .select("id, event_name, email, created_at")
      .single();

    if (error) {
      console.error("[notify-auth] insert error:", error);
      return NextResponse.json(
        { error: "DB insert error", details: error.message },
        { status: 500 }
      );
    }

    // ✅ On renvoie ce qui a été inséré, pour que tu le voies dans Network → Response
    return NextResponse.json(
      { ok: true, inserted: data },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[notify-auth] fatal:", e);
    return NextResponse.json(
      { ok: false, message: "Erreur interne.", details: e?.message },
      { status: 500 }
    );
  }
}

