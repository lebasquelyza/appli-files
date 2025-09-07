import type { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        url: "https://accounts.spotify.com/authorize",
        params: {
          // ajoute playlist-read-private pour l’exemple playlists
          scope: "user-read-email user-read-private playlist-read-private",
          // show_dialog: true, // décommente si tu veux forcer le re-consent
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        const expiresAtMs =
          typeof (account as any).expires_at === "number"
            ? (account as any).expires_at * 1000
            : Date.now() + Number((account as any).expires_in ?? 3600) * 1000;

        token.accessToken = (account as any).access_token as string | undefined;
        token.refreshToken =
          ((account as any).refresh_token as string | undefined) ?? token.refreshToken;
        token.expiresAt = expiresAtMs;
      }
      return token;
    },
    async session({ session, token }) {
      // @ts-expect-error - on étend la session
      session.accessToken = token.accessToken;
      return session;
    },
  },
  // debug: process.env.NEXTAUTH_DEBUG === "true",
};
