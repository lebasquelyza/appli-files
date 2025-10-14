// app/api/programme/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const R_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const R_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

/** Exécute une commande Redis REST Upstash */
async function redisCmd(command: (string | number)[]) {
  if (!R_URL || !R_TOKEN) return null;
  const res = await fetch(R_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${R_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ command }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return json?.result ?? null;
}

async function redisGetJSON(key: string): Promise<any | null> {
  const str = await redisCmd(["GET", key]);
  if (!str || typeof str !== "string") return null;
  try { return JSON.parse(str); } catch { return null; }
}

/* ===================== Route GET ===================== */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const user = searchParams.get("user") || "me";
    const programme = await redisGetJSON(`fc:program:${user}`);

    // Si rien en stockage, renvoyer structure vide — ton front gère le fallback local côté page.
    return NextResponse.json(programme ?? { sessions: [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { sessions: [], error: "READ_FAILED", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
