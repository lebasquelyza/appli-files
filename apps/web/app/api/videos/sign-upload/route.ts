// apps/web/app/api/storage/sign-upload/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // ⚠️ service role, serveur uniquement
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const { filename, contentType } = await req.json();

    if (!filename) {
      return NextResponse.json({ error: "filename requis" }, { status: 400 });
    }

    // ⚠️ PAS de slash initial
    const safeName = filename.replace(/[^\w.\-]/g, "_");
    const path = `uploads/${Date.now()}-${safeName}`;

    // Crée une URL d’upload signée pour le bucket "videos"
    const { data, error } = await supabaseAdmin
      .storage
      .from("videos")
      .createSignedUploadUrl(path);

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "createSignedUploadUrl failed" }, { status: 500 });
    }

    // Retourne tel quel. Ne pas JSON-stringifier le token à part.
    return NextResponse.json({
      path, // ex: "uploads/1234-file.webm"
      token: data.token, // string opaque
      contentType: contentType || "application/octet-stream"
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
