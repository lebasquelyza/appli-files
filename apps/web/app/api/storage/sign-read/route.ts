// apps/web/app/api/storage/sign-read/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,         // ⚠️ service role — serveur uniquement
  { auth: { persistSession: false } }
);

const BUCKET = "videos";

function json(status: number, data: any) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  try {
    const { path, expiresIn } = await req.json().catch(() => ({}));
    if (!path) return json(400, { error: "path requis" });

    const ttl = Number.isFinite(expiresIn) ? Math.max(60, Math.min(60 * 60 * 24, Number(expiresIn))) : 3600;

    const { data, error } = await supabaseAdmin
      .storage
      .from(BUCKET)
      .createSignedUrl(path, ttl);

    if (error || !data?.signedUrl) {
      return json(500, { error: error?.message || "createSignedUrl failed" });
    }

    return json(200, { url: data.signedUrl });
  } catch (e: any) {
    return json(500, { error: e?.message || "server error" });
  }
}
