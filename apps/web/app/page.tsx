// apps/web/app/page.tsx
import dynamic from "next/dynamic";

// Import dynamique du composant client (AuthCard) côté client uniquement
const AuthCard = dynamic(() => import("../components/AuthCard"), { ssr: false });

export default function Home() {
  return (
    <main>
      <section className="py-10">
        <div
          className="container max-w-screen-lg mx-auto grid md:grid-cols-2 gap-10 items-start"
          style={{ alignItems: "start" }}
        >
          <div>
            <h1 className="h1">Files Le Coach — Coach Sportif IA</h1>
            <p className="lead">Séances personnalisées, conseils et suivi.</p>
            <div style={{ height: 16 }} />
            <ul className="space-y-3 list-disc pl-5">
              <li>Programme personnalisé</li>
              <li>Minuteur &amp; Musique</li>
              <li>Recettes healthy</li>
            </ul>
            <div style={{ height: 16 }} />
            <a className="btn" href="/dashboard">
              Entrer dans le dashboard
            </a>
          </div>

          {/* Bloc Auth (connexion / création de compte + mot de passe oublié) */}
          <AuthCard />
        </div>
      </section>
    </main>
  );
}
