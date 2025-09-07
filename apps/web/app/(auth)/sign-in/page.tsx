// apps/web/app/(auth)/sign-in/page.tsx
"use client";
import ConnectSpotifyButton from "@/components/ConnectSpotifyButton";

export default function SignInPage() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: 360, display: "grid", gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Connexion</h1>

        {/* Bouton Spotify seul pour le test */}
        <ConnectSpotifyButton />

        {/* Lien brut (sans JS) : contourne totalement le composant */}
        <a
          href="/api/auth/signin/spotify?callbackUrl=%2Fdashboard%2Fmusic"
          style={{ display: "block", textAlign: "center", border: "1px solid #ddd", padding: 10, borderRadius: 8 }}
        >
          Démarrer OAuth via lien direct
        </a>
      </div>
    </main>
  );
}
