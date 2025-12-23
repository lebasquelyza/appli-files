// apps/web/lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import { prisma } from "@/lib/prisma";

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
  if (!res.ok) throw new Error((data as any)?.error_description || "Failed to refresh token");

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
            "user-library-read",
          ].join(" "),
          show_dialog: true,
        },
      },
    }),
  ],
  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account, profile, user }) {
      // ✅ 1) Capturer email/name/image au login
      // Spotify renvoie l’email dans "profile.email" si scope user-read-email
      const email =
        (profile as any)?.email ??
        (user as any)?.email ??
        (token as any).email;

      if (email) (token as any).email = email;

      const name =
        (profile as any)?.display_name ??
        (user as any)?.name ??
        token.name;
      if (name) token.name = name;

      const image =
        Array.isArray((profile as any)?.images) && (profile as any).images[0]?.url
          ? (profile as any).images[0].url
          : (user as any)?.image;
      if (image) (token as any).image = image;

      // ✅ 2) Tokens Spotify comme avant
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

      // ✅ 3) Refresh si besoin
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

      // ✅ user.id stable (Spotify id via token.sub)
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }

      // ✅ IMPORTANT: remettre email/name/image dans la session
      if (session.user) {
        (session.user as any).email = (token as any).email ?? session.user.email;
        session.user.name = token.name ?? session.user.name;
        (session.user as any).image = (token as any).image ?? (session.user as any).image;
      }

      // ✅ Upsert AppUser
      try {
        const id = (session.user as any)?.id as string | undefined;
        if (id) {
          await prisma.appUser.upsert({
            where: { id },
            update: {
              email: (session.user as any).email ?? undefined,
              name: session.user.name ?? undefined,
              image: (session.user as any).image ?? undefined,
            },
            create: {
              id,
              email: (session.user as any).email ?? undefined,
              name: session.user.name ?? undefined,
              image: (session.user as any).image ?? undefined,
            },
          });
        }
      } catch (e) {
        console.error("AppUser upsert failed", e);
      }

      return session;
    },
  },
};
