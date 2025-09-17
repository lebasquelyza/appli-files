import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "present" : "missing";
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY ? "present" : "missing";

    const okUrl = !!url && /^https?:\/\/.+supabase\.co/.test(url || "");
    if (!okUrl) {
      return NextResponse.json({ ok: false, step: "env", url, anon, service }, { status: 500 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .storage
      .from("videos")
      .createSignedUploadUrl(`diag/${Date.now()}.txt`);

    return NextResponse.json(
      {
        ok: !error && !!data?.token,
        step: "storage.createSignedUploadUrl",
        error: error?.message || null,
        env: { url, anon, service },
      },
      { status: !error ? 200 : 500 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, step: "exception", error: e?.message || String(e) }, { status: 500 });
  }
}
