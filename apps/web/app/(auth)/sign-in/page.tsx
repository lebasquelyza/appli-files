"use client";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div className="container" style={{paddingTop:120, paddingBottom:40}}>
      <div className="card" style={{maxWidth:480, margin:"0 auto"}}>
        <h1 className="h1">Connexion</h1>
        <p className="lead">Connecte-toi pour accéder au dashboard.</p>

        <div style={{height:10}} />
        <button
          className="btn"
          onClick={() => signIn("spotify", { callbackUrl: "/dashboard/music" })}
        >
          Continuer avec Spotify
        </button>

        <div style={{height:8}} />
        <p className="text-sm" style={{color:"#6b7280"}}>
          Nécessite un compte Spotify Premium pour la lecture dans l’appli.
        </p>
      </div>
    </div>
  );
}
