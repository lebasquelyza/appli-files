import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/url";

export const runtime = "nodejs";

export async function POST() {
  const base = getBaseUrl();
  const jar = cookies();
  jar.set("conn_strava", "", { path: "/", maxAge: 0 });
  jar.set("conn_strava_name", "", { path: "/", maxAge: 0 });
  return NextResponse.redirect(`${base}/dashboard/connect?disconnected=strava`);
}
