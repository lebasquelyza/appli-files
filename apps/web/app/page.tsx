// apps/web/app/page.tsx
"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main style={{ paddingTop: 90 }}>
      <section>
        <div
          className="container"
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr .9fr",
            gap: 34,
            alignItems: "center",
          }}
        >
          {/* Texte d'accueil identique */}
          <div>
            <h1 className="h1">Files Le Coach — Coach Sportif IA</h1>
            <p className="lead">Séances personnalisées, conseils et suivi.</p>
            <div style={{ height: 16 }} />
            <ul className="space-y-4" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Programme personnalisé</li>
              <li>Minuteur & Musique</li>
              <li>Recettes healthy</li>
            </ul>

            {/* ✅ Boutons Connexion / Créer un compte dans le même style que l’ancien bouton */}
            <div style={{ marginTop: 32, display: "flex", gap: 12 }}>
              <button
                onClick={() => router.push("/signin")}
                className="btn"
                style={{ flex: 1 }}
              >
                Connexion
              </button>
              <button
                onClick={() => router.push("/signup")}
                className="btn"
                style={{ flex: 1 }}
              >
                Créer un compte
              </button>
            </div>
          </div>

          {/* Carte à droite (inchangée) */}
          <div className="card">
            <ul className="space-y-4" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Programme personnalisé</li>
              <li>Minuteur & Musique</li>
              <li>Recettes healthy</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
