"use client";
import { signIn } from "next-auth/react";

export function ConnectSpotifyButton({ callbackUrl = "/dashboard/music" }:{
  callbackUrl?: string;
}) {
  return (
    <button className="btn" onClick={() => signIn("spotify", { callbackUrl })}>
      Se connecter à Spotify
    </button>
  );
}

export default ConnectSpotifyButton;
