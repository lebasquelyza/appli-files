// apps/web/app/api/storage/sign-read/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const { path, expiresIn = 3600 } = await req.json();
    if (!path) return NextResponse.json({ error: "path requis" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .storage
      .from("videos")
      .createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message || "createSignedUrl failed" }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
