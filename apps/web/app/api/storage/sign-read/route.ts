// apps/web/app/api/storage/sign-read/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const path = body?.path as string | undefined;
    const expiresIn = Number(body?.expiresIn ?? 3600); // 1h

    if (!path) {
      return NextResponse.json({ error: "path manquant" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage
      .from("videos")
      .createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message || "createSignedUrl a échoué" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erreur interne sign-read" },
      { status: 500 }
    );
  }
}
