// apps/web/lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

export const authOptions: NextAuthOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization:
        "https://accounts.spotify.com/authorize?scope=" +
        [
          "user-read-email",
          "user-read-private",
          "user-read-playback-state",
          "user-modify-playback-state",
          "streaming",
        ].join(" "),
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      // On stocke les tokens Spotify la 1ère fois
      if (account && account.access_token) {
        token.accessToken = account.access_token as string;
        token.refreshToken = (account.refresh_token as string) || token.refreshToken;
        token.expiresAt = (account.expires_at as number) ? (account.expires_at as number) * 1000 : undefined;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      return session;
    },
  },
  // Active les logs si besoin de debug
  // debug: true,
};
