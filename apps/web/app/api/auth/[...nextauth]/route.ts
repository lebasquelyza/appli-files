import NextAuth from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

const handler = NextAuth({
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        url: "https://accounts.spotify.com/authorize",
        params: {
          scope: ["user-read-email", "user-read-private"].join(" "),
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        // Certains adapters exposent expires_at (en secondes epoch). Sinon, fallback sur expires_in.
        const expiresAtMs =
          typeof account.expires_at === "number"
            ? account.expires_at * 1000
            : Date.now() + Number(account.expires_in ?? 3600) * 1000;

        token.accessToken = account.access_token as unknown as string;
        token.refreshToken = (account.refresh_token as unknown as string) ?? token.refreshToken;
        token.expiresAt = expiresAtMs; // <-- number (ms)
      }
      return token;
    },
    async session({ session, token }) {
      // @ts-expect-error - on étend le type via la déclaration ci-dessous
      session.accessToken = token.accessToken;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
