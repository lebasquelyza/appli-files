import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/url";
export const runtime = "nodejs";
export async function GET() {
  const base = getBaseUrl();
  return NextResponse.redirect(`${base}/dashboard/connect?error=coming-soon`);
}
