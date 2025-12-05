// app/api/account/delete/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supaAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: userData, error: uErr } = await supaAnon.auth.getUser(token);
  if (uErr || !userData?.user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Récupère le motif facultatif
  let reason: string | null = null;
  let reasonText: string | null = null;
  try {
    const body = await req.json();
    reason = body?.reason ?? null;
    reasonText = body?.reasonText ?? null;
  } catch {}

  // (Optionnel) journaliser le motif dans une table
  // create table account_deletions (user_id uuid primary key, reason text, reason_text text, deleted_at timestamptz default now());
  try {
    const adminAnonWriter = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await adminAnonWriter
      .from("account_deletions")
      .insert({ user_id: userData.user.id, reason, reason_text: reasonText })
      .throwOnError();

    const { error: dErr } = await adminAnonWriter.auth.admin.deleteUser(userData.user.id);
    if (dErr) throw dErr;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
