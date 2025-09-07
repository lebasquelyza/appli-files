"use client";
import { signIn } from "next-auth/react";

export default function ConnectSpotifyButton() {
  const handleClick = () => {
    // Redirige vers le provider "spotify"
    signIn("spotify", { callbackUrl: "/dashboard/music" });
  };

  return (
    <button type="button" className="btn" onClick={handleClick}>
      Continuer avec Spotify
    </button>
  );
}
