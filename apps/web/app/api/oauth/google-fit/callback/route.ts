import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = cookies();

  const expectedState = jar.get("gf_state")?.value;
  const verifier = jar.get("gf_verifier")?.value;

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return NextResponse.redirect(new URL("/dashboard/connect?error=google-fit-oauth", req.url), { status: 302 });
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_FIT_CLIENT_ID!,
      client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET!,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.APP_BASE_URL!}/api/oauth/google-fit/callback`,
    }),
    cache: "no-store",
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/dashboard/connect?error=google-fit-token", req.url), { status: 302 });
  }

  const payload = await tokenRes.json() as {
    access_token: string; refresh_token?: string; expires_in: number; token_type: string;
  };

  // Stockage minimal en cookies (démo) — préférer un DB en prod
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (payload.expires_in || 3500);

  jar.set("gf_access_token", payload.access_token, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 });
  if (payload.refresh_token) {
    jar.set("gf_refresh_token", payload.refresh_token, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 60 });
  }
  jar.set("gf_expires_at", String(expiresAt), { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 });
  jar.set("conn_google_fit", "1", { path: "/", httpOnly: false, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 30 });

  return NextResponse.redirect(new URL("/dashboard/connect?connected=google-fit", req.url), { status: 302 });
}
