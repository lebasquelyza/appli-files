// apps/web/app/api/storage/sign-read/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function j(status: number, body: any) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function getSbAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!/^https?:\/\//.test(url)) throw Object.assign(new Error("SUPABASE_URL invalide"), { status: 500 });
  if (!key) throw Object.assign(new Error("SUPABASE_SERVICE_ROLE_KEY manquante"), { status: 500 });
  return createClient(url, key, { auth: { persistSession: false } });
}

const BUCKET = process.env.ANALYZE_UPLOAD_BUCKET || "videos";

export async function POST(req: Request) {
  try {
    const { path, expiresIn } = await req.json().catch(() => ({}));
    if (!path) return j(400, { error: "path requis" });

    const ttl = Number.isFinite(expiresIn) ? Math.max(60, Math.min(60 * 60 * 24, Number(expiresIn))) : 3600;

    const sb = getSbAdmin();
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, ttl);

    if (error || !data?.signedUrl) {
      return j(500, { error: error?.message || "createSignedUrl failed" });
    }

    return j(200, { url: data.signedUrl });
  } catch (e: any) {
    return j(500, { error: e?.message || "server error" });
  }
}
