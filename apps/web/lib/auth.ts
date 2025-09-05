// apps/web/lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

type JwtToken = {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpires?: number; // ms epoch
  error?: "RefreshAccessTokenError";
  [key: string]: unknown;
};

async function refreshSpotifyToken(token: JwtToken): Promise<JwtToken> {
  try {
    if (!token.refreshToken) {
      throw new Error("Missing refresh token");
    }
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      throw new Error("SPOTIFY_CLIENT_ID/SECRET manquants");
    }

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    });

    const basic = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");

    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        `Spotify refresh failed ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`
      );
    }

    const accessToken = data.access_token as string;
    const expiresIn = data.expires_in as number; // seconds

    return {
      ...token,
      accessToken,
      accessTokenExpires: Date.now() + expiresIn * 1000,
      refreshToken: (data.refresh_token as string | undefined) ?? token.refreshToken,
      error: undefined,
    };
  } catch (e) {
    console.error("Error refreshing Spotify token", e);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        url: "https://accounts.spotify.com/authorize",
        params: {
          scope:
            "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state",
          // prompt: "consent", // (optionnel) pour forcer un refresh_token
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // Premier login
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token as string | undefined,
          refreshToken: account.refresh_token as string | undefined,
          // Spotify renvoie expires_at en secondes
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : undefi*
