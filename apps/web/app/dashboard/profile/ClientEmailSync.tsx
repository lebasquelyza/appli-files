"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "../../../lib/supabaseClient";

function setCookie(name: string, value: string, days = 365) {
  const maxAge = days * 24 * 60 * 60;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

export default function ClientEmailSync() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    (async () => {
      try {
        // si l'URL a déjà ?email=..., on ne fait rien
        const already = sp.get("email");
        if (already) return;

        const supabase = getSupabase();
        const { data } = await supabase.auth.getUser();
        const email = data?.user?.email?.trim().toLowerCase();
        if (!email) return;

        // pose le cookie lu par le serveur (profile/page.tsx)
        setCookie("app_email", email, 365);

        // relance un rendu serveur avec ?email=...
        router.replace(`/dashboard/profile?email=${encodeURIComponent(email)}&debug=${sp.get("debug") || ""}`);
      } catch {
        // silencieux : pas d’email -> on laisse l’UI telle quelle
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
