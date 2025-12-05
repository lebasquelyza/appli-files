import { NextResponse } from "next/server";
// @ts-ignore optional deps at build time
import { getServerSession } from "next-auth";
// @ts-ignore optional deps at build time
import { authOptions } from "@/lib/auth";

/**
 * Cette route est appelée après la connexion NextAuth (callbackUrl=/after-login).
 * Elle pose les cookies utiles côté serveur (app_email, app_prenom) puis redirige.
 *
 * URL:
 *   /after-login            → redirige vers /dashboard/profile
 *   /after-login?to=/xyz    → redirige vers /xyz
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  // Où rediriger après avoir posé les cookies
  const to = url.searchParams.get("to") || "/dashboard/profile";

  // Récupérer la session NextAuth (email/prénom)
  const session = await getServerSession(authOptions as any);
  const email = (session as any)?.user?.email as string | undefined;
  const name = (session as any)?.user?.name as string | undefined;

  // Préparer la réponse de redirection
  const res = NextResponse.redirect(new URL(to, url));

  // Poser les cookies attendus par le reste de l'app
  if (email) {
    res.cookies.set("app_email", email.toLowerCase(), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 365, // 1 an
    });
  }

  if (name) {
    const prenom = name.split(" ")[0] || name;
    res.cookies.set("app_prenom", prenom, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  // Si jamais il n'y a pas de session, on renvoie à la page de connexion
  if (!email) {
    return NextResponse.redirect(new URL("/sign-in", url));
  }

  return res;
}
