// apps/web/app/dashboard/avis/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      {/* En-tête */}
      <div className="page-header">
        <div>
          <h1 className="h1" style={{ fontSize: 22 }}>Votre avis</h1>
          <p className="lead" style={{ fontSize: 13, marginTop: 4 }}>
            Dis-nous ce que tu penses de l’app pour qu’on puisse l’améliorer 🙌
          </p>
        </div>
      </div>

      {/* Contenu principal */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="card">
          <p className="text-sm" style={{ marginBottom: 12 }}>
            La page “Votre avis” est en cours de construction.
          </p>
          <p className="text-sm" style={{ marginBottom: 4 }}>
            En attendant, tu peux nous écrire à :
          </p>
          <p>
            <a
              href="mailto:support@example.com"
              className="underline"
              style={{ fontWeight: 600 }}
            >
              support@example.com
            </a>
          </p>

          {/* Si tu as un Typeform / Google Form / autre, mets le lien ici */}
          {/* <p className="text-sm" style={{ marginTop: 12 }}>
            Tu peux aussi répondre à ce questionnaire :{" "}
            <Link href="https://ton-formulaire.com" className="underline" target="_blank">
              Donner mon avis
            </Link>
          </p> */}
        </div>
      </section>
    </div>
  );
}
