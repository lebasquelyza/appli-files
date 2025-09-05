import type { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

async function refreshSpotifyToken(token: any) {
  try {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken as string,
    });

    const basic = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");

    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {

        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded"


      },
      body: params.toString(),
      cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok) throw data;

    const accessToken = data.access_token as string;
    const expiresIn = data.expires_in as number; // seconds

    return {
      ...token,
      accessToken,
      accessTokenExpires: Date.now() + expiresIn * 1000,
      refreshToken: data.refresh_token ?? token.refreshToken,
    };
  } catch (e) {
    console.error("Error refreshing Spotify token", e);
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization:
        "https://accounts.spotify.com/authorize?scope=streaming,user-read-email,user-read-private,user-read-playback-state,user-modify-playback-state",
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at! * 1000,
          user,
        };
      }
      if (token.accessTokenExpires && Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }
      return await refreshSpotifyToken(token);
    },
    async session({ session, token }) {
      (session as any).accessToken = (token as any).accessToken;
      (session as any).error = (token as any).error;
      (session as any).spotify = {
        expiresAt: (token as any).accessTokenExpires,
      };
      return session;
    },
  },
};
