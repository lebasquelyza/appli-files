import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/url";

export const runtime = "nodejs";

export async function POST() {
  const base = getBaseUrl();
  const jar = cookies();
  // flags
  jar.set("conn_strava", "", { path: "/", maxAge: 0 });
  jar.set("conn_strava_name", "", { path: "/", maxAge: 0 });
  // tokens
  jar.set("strava_access_token", "", { path: "/", maxAge: 0 });
  jar.set("strava_refresh_token", "", { path: "/", maxAge: 0 });
  jar.set("strava_expires_at", "", { path: "/", maxAge: 0 });

  return NextResponse.redirect(`${base}/dashboard/connect?disconnected=strava`);
}
