// apps/web/app/api/storage/sign-upload/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const { filename, contentType } = await req.json();

    if (!filename) {
      return NextResponse.json({ error: "filename manquant" }, { status: 400 });
    }

    // IMPORTANT: pas de slash au début, nettoyer le nom
    const clean = String(filename)
      .replace(/^\/+/, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    const path = `${Date.now()}_${clean}`;

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage
      .from("videos")
      .createSignedUploadUrl(path); // ✅ pas d'autres args

    if (error || !data?.token) {
      return NextResponse.json(
        { error: `createSignedUploadUrl failed: ${error?.message || "unknown"}` },
        { status: 500 }
      );
    }

    // On renvoie juste ce qui est nécessaire au client
    return NextResponse.json({
      path,                 // ex: "1729012345678_clip.mp4"
      token: data.token,    // token d’upload
      // facultatif: data.signedUrl si tu veux debug
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur interne" }, { status: 500 });
  }
}
