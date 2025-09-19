import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_BUCKET = process.env.ANALYZE_UPLOAD_BUCKET || "analyze-uploads-public";

function json(status: number, data: unknown) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function readBody(req: NextRequest) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) return {};
    return await req.json();
  } catch { return {}; }
}

/** POST Body: { path: string, bucket?: string } => { url, token, bucket, path } */
export async function POST(req: NextRequest) {
  try {
    const body = (await readBody(req)) as { path?: string; bucket?: string };
    const path = body?.path;
    const bucket = body?.bucket || DEFAULT_BUCKET;
    if (!path || typeof path !== "string") return json(400, { error: "Body attendu: { path: string, bucket?: string }" });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data?.signedUrl || !data?.token) return json(500, { error: error?.message || "createSignedUploadUrl failed" });

    return json(200, { url: data.signedUrl, token: data.token, bucket, path });
  } catch (e:any) {
    const status = Number.isInteger(e?.status) ? e.status : 500;
    return json(status, { error: e?.message || "server error" });
  }
}

export async function GET() { return json(200, { ok: true }); }
