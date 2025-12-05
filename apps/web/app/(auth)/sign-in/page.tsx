import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ConnectSpotifyButton from "@/components/ConnectSpotifyButton";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);

  // Dès que l'utilisateur est connecté, on passe par /after-login
  // pour poser les cookies (app_email, app_prenom) et rediriger proprement.
  if (session) redirect("/after-login");

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: 360, display: "grid", gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Se connecter</h1>
        <p>Connecte ton compte Spotify pour continuer.</p>

        {/* ⚠️ Assure-toi que ce composant utilise aussi callbackUrl=/after-login */}
        <ConnectSpotifyButton />

        {/* Lien direct NextAuth → Spotify avec callback vers /after-login */}
        <a
          href="/api/auth/signin/spotify?callbackUrl=%2Fafter-login"
          style={{ display: "block", textAlign: "center", border: "1px solid #ddd", padding: 10, borderRadius: 8 }}
        >
          Ou démarrer la connexion via Spotify
        </a>
      </div>
    </main>
  );
}
