// apps/web/app/api/videos/sign-upload/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function j(status: number, body: any) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
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
    const { filename } = await req.json().catch(() => ({}));
    const base = slugify(filename || `upload-${Date.now()}.webm`);
    const path = `${Date.now()}-${base}`;

    const sb = getSbAdmin();
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data?.signedUrl || !data?.token) {
      console.error("[sign-upload] error:", error?.message);
      return j(500, { error: "createSignedUploadUrl_failed", detail: error?.message || "unknown" });
    }

    return j(200, { path, bucket: BUCKET, signedUrl: data.signedUrl, token: data.token });
  } catch (e: any) {
    console.error("[sign-upload] 500:", e?.message);
    return j(500, { error: e?.message || "internal_error" });
  }
}

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 140);
}
