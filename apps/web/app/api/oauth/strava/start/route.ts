import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/url";

export const runtime = "nodejs";

export async function GET() {
  const base = getBaseUrl();
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "STRAVA_CLIENT_ID manquant" }, { status: 500 });

  const redirectUri = `${base}/api/oauth/strava/callback`;
  const authorize = new URL("https://www.strava.com/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("approval_prompt", "auto");
  authorize.searchParams.set("scope", "read,activity:read_all");

  return NextResponse.redirect(authorize.toString(), { status: 302 });
}
