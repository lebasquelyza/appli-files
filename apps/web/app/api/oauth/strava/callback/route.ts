import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/url";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const base = getBaseUrl();

  if (error) {
    return NextResponse.redirect(`${base}/dashboard/connect?error=strava_${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${base}/dashboard/connect?error=strava_code_absent`);
  }

  const clientId = process.env.STRAVA_CLIENT_ID!;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET!;
  const redirectUri = `${base}/api/oauth/strava/callback`;

  try {
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      return NextResponse.redirect(`${base}/dashboard/connect?error=strava_token_${encodeURIComponent(txt.slice(0,120))}`);
    }

    const payload = await tokenRes.json();
    // Tu pourrais stocker en DB ici. Pour une première passe, on met juste un flag local :
    const jar = cookies();
    jar.set("conn_strava", "1", { path: "/", sameSite: "lax", httpOnly: false, maxAge: 60 * 60 * 24 * 365 });

    const athlete = payload?.athlete?.username || payload?.athlete?.firstname || "Strava";
    jar.set("conn_strava_name", String(athlete), { path: "/", sameSite: "lax", httpOnly: false, maxAge: 60 * 60 * 24 * 30 });

    return NextResponse.redirect(`${base}/dashboard/connect?connected=strava`);
  } catch (e: any) {
    return NextResponse.redirect(`${base}/dashboard/connect?error=strava_exception`);
  }
}
