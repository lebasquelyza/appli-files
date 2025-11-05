// apps/web/app/dashboard/avis/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="page-header">
        <div>
          <h1 className="h1" style={{ fontSize: 22 }}>Votre avis</h1>
          <p className="lead" style={{ fontSize: 13, marginTop: 4 }}>
            Dis-nous ce que tu penses de Files pour qu’on puisse améliorer l’app 🙌
          </p>
        </div>
      </div>

      <section className="section" style={{ marginTop: 12 }}>
        <div className="card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert("Merci pour ton avis 🙏 (formulaire à brancher côté backend)");
            }}
          >
            <label
              htmlFor="feedback"
              className="label"
              style={{ display: "block", fontWeight: 700, marginBottom: 6 }}
            >
              Ton message
            </label>
            <textarea
              id="feedback"
              name="feedback"
              rows={5}
              className="input"
              style={{ width: "100%", resize: "vertical" }}
              placeholder="Dis-nous ce qui te plaît, ce qu’on peut améliorer, des idées de fonctionnalités..."
            />

            <button
              type="submit"
              className="btn btn-dash"
              style={{ marginTop: 12, fontWeight: 700 }}
            >
              Envoyer mon avis
            </button>
          </form>

          {/* Option : lien vers un Typeform/Google Form si tu en as un */}
          {/* 
          <p className="text-sm" style={{ marginTop: 16, color: "#6b7280" }}>
            Tu peux aussi répondre via ce formulaire externe :{" "}
            <Link href="https://ton-formulaire.com" target="_blank" className="underline">
              Donner mon avis
            </Link>
          </p>
          */}
        </div>
      </section>
    </div>
  );
}
