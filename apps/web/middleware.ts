import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => req.cookies.get(name)?.value,
          set: (name: string, value: string, options: any) => {
            // on écrit dans la réponse
            res.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove: (name: string, options: any) => {
            res.cookies.set({
              name,
              value: "",
              ...options,
              maxAge: 0,
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.getUser();
    const email = data?.user?.email?.trim().toLowerCase();

    if (!error && email) {
      // Cookie lu par /dashboard/profile
      res.cookies.set({
        name: "app_email",
        value: email,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        maxAge: 60 * 60 * 24 * 365, // 1 an
      });
    }
  } catch {
    // silencieux: on ne bloque pas la requête si Supabase n'est pas dispo
  }

  return res;
}

// Limiter le middleware aux pages dashboard (change si besoin)
export const config = {
  matcher: ["/dashboard/:path*"],
};
