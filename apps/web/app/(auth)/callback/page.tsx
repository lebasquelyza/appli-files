// apps/web/app/auth/callback/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "../../../lib/supabaseClient";

// petit helper pour ton cookie app_email
function setAppEmailCookie(val: string) {
  try {
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    document.cookie = [
      `app_email=${encodeURIComponent(val)}`,
      "Path=/",
      "SameSite=Lax",
      isHttps ? "Secure" : "",
      "Max-Age=31536000",
    ].filter(Boolean).join("; ");
  } catch {}
}

export default function AuthCallbackPage() {
  const sp = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();

        // Les liens Supabase peuvent arriver avec ?code=... (GoTrue v2)
        // ou parfois des fragments #access_token=... selon config.
        const code = sp.get("code");

        if (code) {
          // ❱ Échange le code contre une session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          // Pose le cookie app_email (utile pour tes pages serveur)
          const email = data?.user?.email?.trim().toLowerCase();
          if (email) setAppEmailCookie(email);

          setStatus("ok");
          window.location.replace("/dashboard");
          return;
        }

        // Fallback: si déjà connecté (ex: auto-confirm) → va au dashboard
        const { data: sessionData } = await supabase.auth.getUser();
        if (sessionData?.user) {
          const email = sessionData.user.email?.trim().toLowerCase();
          if (email) setAppEmailCookie(email);
          setStatus("ok");
          window.location.replace("/dashboard");
          return;
        }

        throw new Error("Lien invalide ou expiré.");
      } catch (e: any) {
        setStatus("error");
        setError(e?.message || "Impossible de finaliser la connexion.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        {status === "loading" && <p>Validation de votre compte…</p>}
        {status === "ok" && <p>Connexion en cours…</p>}
        {status === "error" && (
          <>
            <p className="text-red-600 font-medium">Erreur</p>
            <p className="text-sm text-gray-600 mt-2">{error}</p>
            <a href="/"
               className="inline-block mt-4 underline">
              Revenir à l’accueil
            </a>
          </>
        )}
      </div>
    </main>
  );
}
