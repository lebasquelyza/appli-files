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
  if (!res.ok) {
    throw new Error((data as any)?.error_description || "Failed to refresh token");
  }

  const expiresAt = Date.now() + Number((data as any).expires_in ?? 3600) * 1000;

  return {
    accessToken: (data as any).access_token as string,
    refreshToken: ((data as any).refresh_token as string) || refreshToken,
    expiresAt,
  };
}

export const authOptions: NextAuthOptions = {
  pages: { signIn: "/sign-in" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        url: "https://accounts.spotify.com/authorize",
        params: {
          scope: [
            "user-read-email",
            "user-read-private",
            "playlist-read-private",
            "streaming",
            "user-modify-playback-state",
            "user-read-playback-state",
            "user-library-read", // ⬅️ accès aux titres likés
          ].join(" "),
          show_dialog: true, // ⬅️ force le nouvel écran de consentement (tu pourras le remettre en commentaire après)
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      // Premier login ou renouvellement initial
      if (account) {
        const expiresAt =
          typeof (account as any).expires_at === "number"
            ? (account as any).expires_at * 1000
            : Date.now() + Number((account as any).expires_in ?? 3600) * 1000;

        (token as any).accessToken = (account as any).access_token;
        (token as any).refreshToken =
          (account as any).refresh_token ?? (token as any).refreshToken;
        (token as any).expiresAt = expiresAt;

        return token;
      }

      // Refresh token si proche de l'expiration
      const exp =
        typeof (token as any).expiresAt === "number"
          ? (token as any).expiresAt
          : (token as any).expiresAt
          ? Number((token as any).expiresAt)
          : 0;

      if (exp && Date.now() > exp - 60_000 && (token as any).refreshToken) {
        try {
          const r = await refreshSpotifyToken((token as any).refreshToken as string);
          (token as any).accessToken = r.accessToken;
          (token as any).refreshToken = r.refreshToken;
          (token as any).expiresAt = r.expiresAt;
        } catch {
          (token as any).accessToken = undefined;
          (token as any).refreshToken = undefined;
          (token as any).expiresAt = undefined;
        }
      }

      return token;
    },

    async session({ session, token }) {
      (session as any).accessToken = (token as any).accessToken;
      return session;
    },
  },
};

