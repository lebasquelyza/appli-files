import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const { path, expiresIn = 60 * 60 } = await req.json();
    if (!path) {
      return NextResponse.json({ error: "path requis" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .storage
      .from("videos")
      .createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) {
      throw error || new Error("createSignedUrl failed");
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (e: any) {
    console.error("sign-read error:", e);
    return NextResponse.json({ error: e?.message || "sign-read error" }, { status: 500 });
  }
}
