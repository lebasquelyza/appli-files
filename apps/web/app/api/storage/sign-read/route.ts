// apps/web/app/api/storage/sign-read/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "videos";

/** Réponse JSON utilitaire */
function json(status: number, data: unknown) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/** Création paresseuse du client Supabase — surtout pas au top-level */
function getSupabaseAdmin(): SupabaseClient {
  // Tolère SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";

  // Pour signer des URLs, privilégie la service role (sinon anon en dernier recours)
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  if (!url || !key) {
    // Ne pas throw au chargement du module — seulement ici, au runtime
    const missing = [];
    if (!url) missing.push("SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL");
    if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const err = new Error("Supabase env missing: " + missing.join(", "));
    (err as any).status = 500;
    throw err;
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

/** Body parser safe */
async function readBody(req: NextRequest) {
  try {
    const ctype = (req.headers.get("content-type") || "").toLowerCase();
    if (!ctype.includes("application/json")) return {};
    return await req.json();
  } catch {
    return {};
  }
}

/** POST /api/storage/sign-read
 * Body: { path: string, expiresIn?: number }
 * Retour: { url: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { path, expiresIn } = (await readBody(req)) as {
      path?: string;
      expiresIn?: number;
    };

    if (!path || typeof path !== "string") {
      return json(400, { error: "Body attendu: { path: string, expiresIn?: number }" });
    }

    const ttl = Number.isFinite(expiresIn)
      ? Math.max(60, Math.min(60 * 60 * 24, Number(expiresIn))) // 60s .. 24h
      : 3600;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, ttl);

    if (error || !data?.signedUrl) {
      return json(500, { error: error?.message || "createSignedUrl failed" });
    }

    return json(200, { url: data.signedUrl });
  } catch (e: any) {
    const status = Number.isInteger(e?.status) ? e.status : 500;
    return json(status, { error: e?.message || "server error" });
  }
}

/** GET simple pour healthcheck */
export async function GET() {
  return json(200, { ok: true });
}
