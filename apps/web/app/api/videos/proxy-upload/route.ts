/* apps/web/app/api/videos/proxy-upload/route.ts */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function err(status: number, msg: string) {
  return new NextResponse(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!/^https?:\/\//.test(url)) {
    throw new Error("SUPABASE_URL invalide (ex: https://xxx.supabase.co)");
  }
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
  return createClient(url, key, { auth: { persistSession: false } });
}

const BUCKET = process.env.ANALYZE_UPLOAD_BUCKET || "videos";

export async function POST(req: Request) {
  try {
    // NOTE: Netlify Functions ont une limite de taille (≈10–50 Mo selon plan).
    // Pour des fichiers très gros, privilégier l’upload direct signé.
    const form = await req.formData();
    const file = form.get("file");
    const filename = String(form.get("filename") || "");
    const contentType = String(form.get("contentType") || "application/octet-stream");

    if (!(file instanceof Blob)) return err(400, "FormData attendu: { file: Blob, filename?: string, contentType?: string }");

    const sb = getSupabaseAdmin();

    // Chemin objet
    const base = filename ? slugify(filename) : `upload-${Date.now()}.webm`;
    const path = `${Date.now()}-${base}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, new Uint8Array(arrayBuffer), {
      contentType,
      upsert: false,
    });

    if (upErr) return err(500, `upload failed: ${upErr.message}`);

    // URL signée (lecture)
    const { data: signed, error: signErr } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    if (signErr || !signed?.signedUrl) return err(500, `createSignedUrl failed: ${signErr?.message || "unknown"}`);

    return NextResponse.json({ path, bucket: BUCKET, url: signed.signedUrl }, { headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    const msg = e?.message || "server error";
    const status = Number.isInteger(e?.status) ? e.status : 500;
    return err(status, msg);
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
