// apps/web/app/dashboard/avis/page.tsx
import nodemailer from "nodemailer";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Server Action : envoi l'avis par email */
async function sendFeedback(formData: FormData) {
  "use server";

  const message = (formData.get("feedback") || "").toString().trim();

  if (!message) {
    // Pas de message -> on revient avec une petite erreur
    redirect("/dashboard/avis?error=empty");
  }

  // Transporteur SMTP (à configurer dans tes variables d'environnement)
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === "true", // true si port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Email qui part vers TA boîte
  await transporter.sendMail({
    from: `"Files App" <no-reply@files-app.test>`, // adapte le domaine si tu veux
    to: "sportifandpro@gmail.com",
    subject: "Nouvel avis utilisateur",
    text: message,
  });

  // On revient sur la même page avec un flag de succès
  redirect("/dashboard/avis?sent=1");
}

export default function Page({
  searchParams,
}: {
  searchParams?: { sent?: string; error?: string };
}) {
  const sent = searchParams?.sent === "1";
  const hasError = searchParams?.error === "empty";

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

      {/* Message de succès */}
      {sent && (
        <div
          className="card"
          style={{
            marginTop: 12,
            border: "1px solid rgba(16,185,129,.35)",
            background: "rgba(16,185,129,.08)",
            fontWeight: 600,
          }}
        >
          Merci pour ton avis 🙏 On lit tous les messages avec attention.
        </div>
      )}

      {/* Message d'erreur si texte vide */}
      {hasError && (
        <div
          className="card"
          style={{
            marginTop: 12,
            border: "1px solid rgba(239,68,68,.35)",
            background: "rgba(239,68,68,.08)",
            fontWeight: 600,
          }}
        >
          Oups 😅 Merci d&apos;écrire un petit message avant d&apos;envoyer.
        </div>
      )}

      {/* Formulaire */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="card">
          <form action={sendFeedback}>
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
              rows={6}
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
        </div>
      </section>
    </div>
  );
}
