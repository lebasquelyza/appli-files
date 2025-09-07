// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        url: "https://accounts.spotify.com/authorize",
        params: {
          scope: "user-read-email user-read-private",
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
        token.refreshToken = ((account as any).refresh_token as string | undefined) ?? token.refreshToken;
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
  // debug: true,
});

export { handler as GET, handler as POST };
