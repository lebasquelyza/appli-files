import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Expose uniquement les variables publiques nécessaires au client. */
export async function GET() {
  return NextResponse.json({
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  });
}
