// apps/web/app/api/videos/sign-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_BUCKET = process.env.ANALYZE_UPLOAD_BUCKET || "analyze-uploads-public";

/* --- helpers --- */
function json(status: number, data: unknown) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/** Création paresseuse du client Supabase (surtout pas au top-level) */
function getSupabaseAdmin(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  if (!url || !key) {
    const missing: string[] = [];
    if (!url) missing.push("SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL");
    if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const err = new Error("Supabase env missing: " + missing.join(", "));
    (err as any).status = 500;
    throw err;
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

async function readBody(req: NextRequest) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) return {};
    return await req.json();
  } catch {
    return {};
  }
}

/**
 * POST /api/videos/sign-upload
 * Body: { path: string, bucket?: string }
 * Retour: { url: string, token: string, bucket: string, path: string }
 *  => utilisable côté client avec storage.from(bucket).uploadToSignedUrl(path, token, file)
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await readBody(req)) as { path?: string; bucket?: string };
    const path = body?.path;
    const bucket = body?.bucket || DEFAULT_BUCKET;

    if (!path || typeof path !== "string") {
      return json(400, { error: "Body attendu: { path: string, bucket?: string }" });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !data?.signedUrl || !data?.token) {
      return json(500, { error: error?.message || "createSignedUploadUrl failed" });
    }

    return json(200, { url: data.signedUrl, token: data.token, bucket, path });
  } catch (e: any) {
    const status = Number.isInteger(e?.status) ? e.status : 500;
    return json(status, { error: e?.message || "server error" });
  }
}

export async function GET() {
  return json(200, { ok: true });
}

