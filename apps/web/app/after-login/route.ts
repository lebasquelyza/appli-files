import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// IMPORTANT: exécution côté Node (pas Edge) pour NextAuth + cookies
export const runtime = "nodejs";

// 1) Tente import standard (selon ta version de NextAuth)
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// 2) Fallback vers l’API NextAuth si besoin
function signInUrl(callback: string) {
  const cb = encodeURIComponent(callback || "/after-login");
  return `/api/auth/signin/spotify?callbackUrl=${cb}`;
}

/**
 * Route appelée en callback après la connexion:
 * - Récupère la session NextAuth (email / name)
 * - Pose les cookies (app_email, app_prenom)
 * - Redirige vers /dashboard/profile (ou ?to=/autre)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const to = url.searchParams.get("to") || "/dashboard/profile";

  // Récupération session NextAuth
  let email = "";
  let name = "";

  try {
    // getServerSession sans req/res est supporté sur App Router (Node runtime)
    const session = await getServerSession(authOptions as any);
    email = ((session as any)?.user?.email || "").toLowerCase().trim();
    name = (session as any)?.user?.name || "";
  } catch (e) {
    // Rien, on gère juste après
  }

  // Si pas de session → repart sur le flow de sign-in avec callback vers /after-login
  if (!email) {
    return NextResponse.redirect(new URL(signInUrl("/after-login"), url));
  }

  const res = NextResponse.redirect(new URL(to, url));

  // Cookie app_email (lu par profile/seance/api)
  res.cookies.set("app_email", email, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 60 * 60 * 24 * 365, // 1 an
  });

  // Cookie app_prenom (facultatif)
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

  return res;
}
