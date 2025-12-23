import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

async function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) return null;

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isUniqueViolation(error: any) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "").toLowerCase();
  return code === "23505" || msg.includes("duplicate") || msg.includes("unique");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const pseudo = String(body?.pseudo ?? "").trim().slice(0, 32);

  const email = (cookies().get("app_email")?.value || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ ok: false, error: "Non connecté" }, { status: 401 });
  }

  const supabaseAdmin = await getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { ok: false, error: "Config serveur manquante (service role)" },
      { status: 500 }
    );
  }

  const { error } = await supabaseAdmin
    .from("profile_extras")
    .upsert(
      { email, pseudo: pseudo || null, updated_at: new Date().toISOString() },
      { onConflict: "email" }
    );

  if (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ ok: false, error: "Pseudo déjà utilisé" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pseudo });
}
