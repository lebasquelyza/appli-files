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
    const { data, error } = await admin.storage.from("videos").createSignedUploadUrl(path);

    if (error || !data?.token) throw error || new Error("createSignedUploadUrl failed");
    return NextResponse.json({
      path,
      token: data.token,
      contentType: contentType || "application/octet-stream",
    });
  } catch (e: any) {
    console.error("videos/sign-upload error:", e);
    // Réponds en texte pour débogage si jamais le JSON pose souci
    return new NextResponse(`videos/sign-upload ERROR: ${e?.message || e}`, { status: 500 });
  }
}
