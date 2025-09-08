import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ConnectSpotifyButton from "@/components/ConnectSpotifyButton";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard/music");

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: 360, display: "grid", gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Se connecter</h1>
        <p>Connecte ton compte Spotify pour continuer.</p>
        <ConnectSpotifyButton />
        <a
          href="/api/auth/signin/spotify?callbackUrl=%2Fdashboard%2Fmusic"
          style={{ display: "block", textAlign: "center", border: "1px solid #ddd", padding: 10, borderRadius: 8 }}
        >
          Ou démarrer la connexion via Spotify
        </a>
      </div>
    </main>
  );
}
