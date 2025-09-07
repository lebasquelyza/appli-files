// apps/web/components/ConnectSpotifyButton.tsx
"use client";
<<<<<<< HEAD

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function ConnectSpotifyButton() {
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  // ✅ Une seule déclaration, correctement orthographiée
  async function handleClick() {
    setErr(null);
    const callback = `${window.location.origin}/dashboard/music`; // URL absolue
    const res = await signIn("spotify", { callbackUrl: callback, redirect: false });
    console.log("signIn result:", res);
    if (res?.error) {
      setErr(res.error);
    } else if (res?.url) {
      router.push(res.url);
    }
  }

  return (
    <>
      <button type="button" className="btn" onClick={handleClick}>
        Continuer avec Spotify
      </button>
      {err && <p className="text-red-600 text-sm mt-2">Erreur: {err}</p>}
    </>
=======

export default function ConnectSpotifyButton() {
  const go = () => {
    // Fallback: redirection directe vers NextAuth
    window.location.href = "/api/auth/signin?callbackUrl=/dashboard/music&provider=spotify";
  };

  return (
    <button type="button" className="btn" onClick={go}>
      Continuer avec Spotify
    </button>
>>>>>>> 0689688 (Add middleware and complete Spotify integration)
  );
}
