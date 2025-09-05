/import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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
    // ... garde ton SpotifyProvider ici (inchangé)
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      if (user && !account?.provider) token.userId = (user as any).id; // login credentials
      // (garde ici ta logique Spotify access/refresh)
      return token;
    },
    async session({ session, token }) {
      (session as any).userId = token.userId;
      // (garde aussi session.spotify si tu l'avais)
      return session;
    },
  },
};
