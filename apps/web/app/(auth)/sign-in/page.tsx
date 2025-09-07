"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function ConnectSpotifyButton() {
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setErr(null);
    const res = await signIn("spotify", {
      callbackUrl: "/dashboard/music",
      redirect: false, // important : on capture l'erreur au lieu de rediriger
    });
    if (res?.error) setErr(res.error);
    else if (res?.url) router.push(res.url);
  }

  return (
    <>
      <button type="button" className="btn" onClick={handleClick}>
        Continuer avec Spotify
      </button>
      {err && <p className="text-red-600 text-sm mt-2">Erreur: {err}</p>}
    </>
  );
}
