// apps/web/app/page.tsx
import dynamic from "next/dynamic";
const AuthCard = dynamic(() => import("../components/AuthCard"), { ssr: false });

export default function Home() {
  return (
    <main>
      <section className="py-10">
        <div className="container max-w-screen-lg mx-auto grid md:grid-cols-2 gap-10 items-start">
          {/* Colonne gauche : texte + AuthCard (remplace le bouton) */}
          <div>
            <h1 className="h1">Files Le Coach — Coach Sportif IA</h1>
            <p className="lead">Séances personnalisées, conseils et suivi.</p>

            <div style={{ height: 16 }} />
            <ul className="space-y-3 list-disc pl-5">
              <li>Programme personnalisé</li>
              <li>Minuteur &amp; Musique</li>
              <li>Recettes healthy</li>
            </ul>

            {/* ⬇️ Remplacement: on met l'AuthCard ici, à la place du bouton */}
            <div className="mt-6">
              <AuthCard />
            </div>
          </div>

          {/* Colonne droite : tu peux laisser vide, ou mettre une image/illustration */}
          <div />
        </div>
      </section>
    </main>
  );
}
