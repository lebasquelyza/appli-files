import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import SpotifyProvider from "next-auth/providers/spotify";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok) throw data;

    return {
      ...token,
      accessToken: data.access_token as string,
      accessTokenExpires: Date.now() + (data.expires_in as number) * 1000,
      refreshToken: (data.refresh_token as string | undefined) ?? token.refreshToken,
    };
  } catch (e) {
    console.error("Error refreshing Spotify token", e);
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Email et mot de passe",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password || "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name || undefined };
      },
    }),
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        url: "https://accounts.spotify.com/authorize",
        params: {
          scope:
            "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // login Credentials → attache l'id
      if (user && !account?.provider) {
        token.userId = (user as any).id;
      }
      // login / link via Spotify
      if (account?.provider === "spotify") {
        token.spotify = {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : undefined,
        };
      }
      // refresh Spotify si expiré
      if (token.spotify?.accessTokenExpires && Date.now() >= token.spotify.accessTokenExpires) {
        const refreshed = await refreshSpotifyToken({
          accessToken: token.spotify.accessToken,
          refreshToken: token.spotify.refreshToken,
        });
        token.spotify = {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          accessTokenExpires: refreshed.accessTokenExpires,
        };
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).userId = token.userId;
      (session as any).spotify = token.spotify || null;
      return session;
    },
  },
};
