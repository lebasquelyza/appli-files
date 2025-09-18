// apps/web/app/api/storage/sign-upload/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,          // ex: https://xxxx.supabase.co
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

function sanitizeName(name: string) {
  return name.replace(/[^\w.\-]/g, "_").slice(0, 180);
}

export async function POST(req: Request) {
  try {
    const { filename, contentType } = await req.json().catch(() => ({}));
    if (!filename) return json(400, { error: "filename requis" });

    const safe = sanitizeName(filename);
    // pas de slash initial !
    const path = `uploads/${Date.now()}-${safe}`;

    const { data, error } = await supabaseAdmin
      .storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data?.token) {
      return json(500, { error: error?.message || "createSignedUploadUrl failed" });
    }

    return json(200, {
      path,                          // ex: "uploads/1699999999-video.webm"
      token: data.token,             // opaque upload token
      contentType: contentType || "application/octet-stream",
    });
  } catch (e: any) {
    return json(500, { error: e?.message || "server error" });
  }
}
