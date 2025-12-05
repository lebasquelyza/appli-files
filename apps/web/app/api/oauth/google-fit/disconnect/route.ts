import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const jar = cookies();
  ["gf_access_token","gf_refresh_token","gf_expires_at","conn_google_fit","google_fit_recent"]
    .forEach((k)=> jar.set(k, "", { path:"/", httpOnly: k!=="conn_google_fit", sameSite:"lax", secure:true, maxAge: 0 }));
  return NextResponse.redirect(new URL("/dashboard/connect?disconnected=Google Fit", req.url), { status: 302 });
}
