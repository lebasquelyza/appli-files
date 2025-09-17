import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { filename, contentType } = await req.json();
    if (!filename) return NextResponse.json({ error: "filename requis" }, { status: 400 });

    const ext = (filename.split(".").pop() || "webm").toLowerCase();
    const path = `uploads/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    // URL d'upload signée valable 5 min
    const { data, error } = await supabaseAdmin
      .storage
      .from("videos")
      .createSignedUploadUrl(path, 60 * 5, { contentType: contentType || "application/octet-stream" });

    if (error || !data) throw error || new Error("createSignedUploadUrl failed");

    // data: { signedUrl, token }
    return NextResponse.json({ path, token: data.token });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "sign-upload error" }, { status: 500 });
  }
}
