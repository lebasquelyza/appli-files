"use client";
import ConnectSpotifyButton from "@/components/ConnectSpotifyButton";

export default function SignInPage() {
  return (
    <div className="container" style={{maxWidth: 560, margin: "40px auto"}}>
      <h1 className="page-title">Connexion</h1>
      <p className="muted">Connecte ton compte pour accéder au dashboard.</p>

      <div style={{height: 12}} />
      <ConnectSpotifyButton />

      <div style={{height: 8}} />
      <p className="text-sm" style={{color:"#6b7280"}}>
        Nécessite un compte Spotify Premium pour la lecture dans l’appli.
      </p>
    </div>
  );
}
