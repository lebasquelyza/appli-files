import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "videos";

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

/** POST Body: { path: string, expiresIn?: number } => { url } */
export async function POST(req: NextRequest) {
  try {
    const { path, expiresIn } = (await readBody(req)) as { path?: string; expiresIn?: number };
    if (!path || typeof path !== "string") return json(400, { error: "Body attendu: { path: string, expiresIn?: number }" });

    const ttl = Number.isFinite(expiresIn) ? Math.max(60, Math.min(86400, Number(expiresIn))) : 3600;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttl);
    if (error || !data?.signedUrl) return json(500, { error: error?.message || "createSignedUrl failed" });

    return json(200, { url: data.signedUrl });
  } catch (e:any) {
    const status = Number.isInteger(e?.status) ? e.status : 500;
    return json(status, { error: e?.message || "server error" });
  }
}

export async function GET() { return json(200, { ok: true }); }
