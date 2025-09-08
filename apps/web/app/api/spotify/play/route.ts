import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken as string | undefined;
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  let playBody: any = {};

  // Si l'appel fournit des uris/context_uri, on les utilise
  if (body?.uris || body?.context_uri) {
    playBody = { uris: body.uris, context_uri: body.context_uri };
  } else {
    // Sinon, on essaie de jouer la 1ʳᵉ playlist de l'utilisateur
    const pl = await fetch("https://api.spotify.com/v1/me/playlists?limit=1", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const j = await pl.json();
    const first = j?.items?.[0];
    if (!first) {
      return NextResponse.json({ error: "No playlist to play" }, { status: 404 });
    }
    playBody = { context_uri: `spotify:playlist:${first.id}` };
  }

  const resp = await fetch("https://api.spotify.com/v1/me/player/play", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(playBody),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    return NextResponse.json({ error: err?.error || err || "Spotify error" }, { status: resp.status });
  }
  return NextResponse.json({ ok: true });
}
