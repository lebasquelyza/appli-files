// apps/web/app/api/storage/sign-upload/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const filename = body?.filename as string | undefined;
    const contentType = (body?.contentType as string | undefined) || "application/octet-stream";

    if (!filename) {
      return NextResponse.json({ error: "filename manquant" }, { status: 400 });
    }

    // Chemin unique dans le bucket "videos"
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}-${filename}`;

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage
      .from("videos")
      .createSignedUploadUrl(path); // v2: pas de TTL ici

    if (error || !data?.token) {
      return NextResponse.json(
        { error: error?.message || "createSignedUploadUrl a échoué" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      path,
      token: data.token,
      contentType,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erreur interne sign-upload" },
      { status: 500 }
    );
  }
}
