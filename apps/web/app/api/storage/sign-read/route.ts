import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { path, expiresIn = 60 * 60 } = await req.json(); // 1h par défaut
    if (!path) return NextResponse.json({ error: "path requis" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .storage
      .from("videos")
      .createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) throw error || new Error("createSignedUrl failed");
    return NextResponse.json({ url: data.signedUrl });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "sign-read error" }, { status: 500 });
  }
}
