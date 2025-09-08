"use client";
import { signIn } from "next-auth/react";

export default function ConnectSpotifyButton() {
  return (
    <button
      type="button"
      className="btn"
      onClick={() => signIn("spotify", { callbackUrl: "/dashboard/music" })}
    >
      Continuer avec Spotify
    </button>
  );
}
