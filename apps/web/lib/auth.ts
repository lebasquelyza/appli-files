import type { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

async function refreshSpotifyToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    client_secret: process.env.SPOTIFY_CLIENT_SECRET!,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || "Failed to refresh token");

  const expiresAt = Date.now() + Number(data.expires_in ?? 3600) * 1000;
  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string) || refreshToken,
    expiresAt,
  };
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
          scope: "user-read-email user-read-private playlist-read-private",
          // show_dialog: true, // ← décommente une fois si tu veux forcer le re-consent
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        const expiresAt =
          typeof (account as any).expires_at === "number"
            ? (account as any).expires_at * 1000
            : Date.now() + Number((account as any).expires_in ?? 3600) * 1000;
        token.accessToken = (account as any).access_token;
        token.refreshToken = (account as any).refresh_token ?? token.refreshToken;
        token.expiresAt = expiresAt;
        return token;
      }

      // Auto-refresh si expiré
      if (token.expiresAt && Date.now() > token.expiresAt - 60_000 && token.refreshToken) {
        try {
          const r = await refreshSpotifyToken(token.refreshToken as string);
          token.accessToken = r.accessToken;
          token.refreshToken = r.refreshToken;
          token.expiresAt = r.expiresAt;
        } catch {
          token.accessToken = undefined;
          token.refreshToken = undefined;
          token.expiresAt = undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // @ts-expect-error extension
      session.accessToken = token.accessToken;
      return session;
    },
  },
};
