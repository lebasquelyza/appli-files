import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const { filename, contentType } = await req.json();
    if (!filename) return NextResponse.json({ error: "filename requis" }, { status: 400 });

    const ext = (filename.split(".").pop() || "webm").toLowerCase();
    const path = `uploads/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .storage
      .from("videos")
      .createSignedUploadUrl(path); // v2: 1 seul arg

    if (error || !data) throw error || new Error("createSignedUploadUrl failed");

    return NextResponse.json({ path, token: data.token, contentType: contentType || "application/octet-stream" });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "sign-upload error" }, { status: 500 });
  }
}
