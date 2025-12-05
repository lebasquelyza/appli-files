import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export const runtime = "nodejs";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

const SCOPES = [
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.location.read",
  "https://www.googleapis.com/auth/fitness.body.read",
];

export async function GET() {
  const jar = cookies();
  const clientId = process.env.GOOGLE_FIT_CLIENT_ID!;
  // ⚠️ Normalise la base (retire tout slash final)
  const base = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");
  const redirectUri = `${base}/api/oauth/google-fit/callback`;

  // PKCE
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const state = crypto.randomBytes(16).toString("base64url");

  jar.set("gf_state", state, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 300 });
  jar.set("gf_verifier", codeVerifier, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 300 });

  // 🔎 Log (apparaitra dans les logs Netlify)
  console.log("[GF] redirect_uri =", redirectUri);

  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString(), { status: 302 });
}
