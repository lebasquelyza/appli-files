// apps/web/app/api/videos/proxy-upload/route.ts
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
const MAX_PROXY_BYTES = Number(process.env.PROXY_UPLOAD_MAX_BYTES || 5 * 1024 * 1024); // 5MB

export async function GET() {
  try {
    const sb = getSbAdmin();
    const { data: bucket, error } = await sb.storage.getBucket(BUCKET);
    return j(200, {
      ok: true,
      hasBucket: !error && !!bucket,
      bucket: bucket?.name || BUCKET,
      env: {
        SUPABASE_URL: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
        SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        BUCKET,
        MAX_PROXY_BYTES,
      },
    });
  } catch (e: any) {
    console.error("[proxy-upload][health] error:", e?.message);
    return j(e?.status || 500, { ok: false, error: e?.message || "health_error" });
  }
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return j(415, { error: "FormData attendu (multipart/form-data)" });
    }

    const form = await req.formData();
    const file = form.get("file");
    const filename = String(form.get("filename") || "");
    const contentType = String(form.get("contentType") || "application/octet-stream");

    if (!(file instanceof Blob)) return j(400, { error: "Paramètre 'file' manquant" });

    if (typeof (file as any).size === "number" && (file as any).size > MAX_PROXY_BYTES) {
      return j(413, { error: "too_big_for_proxy", maxBytes: MAX_PROXY_BYTES });
    }

    const sb = getSbAdmin();
    const base = slugify(filename || "upload.webm");
    const path = `${Date.now()}-${base}`;

    const buf = new Uint8Array(await (file as Blob).arrayBuffer());
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, {
      contentType,
      upsert: false,
    });
    if (upErr) {
      console.error("[proxy-upload] upload error:", upErr.message);
      return j(500, { error: "upload_failed", detail: upErr.message });
    }

    const { data: signed, error: signErr } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (signErr || !signed?.signedUrl) {
      console.error("[proxy-upload] createSignedUrl error:", signErr?.message);
      return j(500, { error: "createSignedUrl_failed", detail: signErr?.message || "unknown" });
    }

    return j(200, { path, bucket: BUCKET, url: signed.signedUrl });
  } catch (e: any) {
    console.error("[proxy-upload] 500:", e?.message, e);
    return j(e?.status || 500, { error: e?.message || "internal_error" });
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
