// apps/web/components/ConnectSpotifyButton.tsx
"use client";
import { signIn } from "next-auth/react";

export function ConnectSpotifyButton() {
  return (
    <button
      className="border rounded px-3 py-2"
      onClick={() => signIn("spotify", { callbackUrl: "/music" })}
    >
      Connecter Spotify
    </button>
  );
}
