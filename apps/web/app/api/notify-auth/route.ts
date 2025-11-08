import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ⚠️ IMPORTANT : ces 2 variables doivent être définies
// dans l'hébergeur (Netlify / Vercel / autre)
const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Client Supabase admin (service_role) côté serveur
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
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

    // 1) INSERT dans auth_events
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("auth_events")
      .insert({
        event_name: eventName,
        email: emailTrim,
        metadata: {
          source: "notify-auth-debug",
          raw_type: typeStr,
        },
      })
      .select("id, event_name, email, created_at")
      .single();

    if (insertError) {
      console.error("[notify-auth] insert error:", insertError);
      return NextResponse.json(
        { error: "DB insert error", details: insertError.message },
        { status: 500 }
      );
    }

    // 2) On renvoie la ligne insérée → tu la vois dans la console
    return NextResponse.json(
      { ok: true, inserted },
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

