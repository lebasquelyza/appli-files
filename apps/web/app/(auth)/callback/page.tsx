"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "../../../lib/supabaseClient";

function setAppEmailCookie(val: string) {
  try {
    const isHttps =
      typeof window !== "undefined" &&
      window.location.protocol === "https:";
    document.cookie = [
      `app_email=${encodeURIComponent(val)}`,
      "Path=/",
      "SameSite=Lax",
      isHttps ? "Secure" : "",
      "Max-Age=31536000",
    ]
      .filter(Boolean)
      .join("; ");
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

        // Récupère le code envoyé par Supabase
        const code = sp.get("code");

        if (!code) {
          throw new Error("Code de validation absent ou invalide.");
        }

        // Échange le code contre une session active
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;

        // Email du user pour ton cookie
        const email = data?.user?.email?.trim().toLowerCase();
        if (email) setAppEmailCookie(email);

        setStatus("ok");

        // 🔥 Très important : on renvoie vers la homepage avec ?
        window.location.replace("/?confirmed=1");
      } catch (e: any) {
        console.error("Callback error:", e);
        setStatus("error");
        setError(e?.message || "Impossible de finaliser l’authentification.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        {status === "loading" && <p>Validation de ton compte…</p>}
        {status === "ok" && <p>Redirection…</p>}
        {status === "error" && (
          <>
            <p className="text-red-600 font-medium">Erreur</p>
            <p className="text-sm text-gray-600 mt-2">{error}</p>
            <a href="/" className="inline-block mt-4 underline">
              Revenir à l’accueil
            </a>
          </>
        )}
      </div>
    </main>
  );
}
