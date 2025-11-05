// apps/web/app/dashboard/avis/page.tsx
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Server Action : envoi l'avis via l'API Resend (sans dépendance npm) */
async function sendFeedback(formData: FormData) {
  "use server";

  const message = (formData.get("feedback") || "").toString().trim();

  if (!message) {
    redirect("/dashboard/avis?error=empty");
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Si la clé n'est pas configurée on évite de planter
    redirect("/dashboard/avis?error=server");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Files App <no-reply@files-app.test>", // tu peux adapter le from
      to: ["sportifandpro@gmail.com"],
      subject: "Nouvel avis utilisateur",
      text: message,
    }),
  });

  if (!res.ok) {
    redirect("/dashboard/avis?error=send");
  }

  // Succès -> on revient sur la page avec un flag "sent"
  redirect("/dashboard/avis?sent=1");
}

export default function Page({
  searchParams,
}: {
  searchParams?: { sent?: string; error?: string };
}) {
  const sent = searchParams?.sent === "1";
  const error = searchParams?.error;

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

      {/* Messages de statut */}
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

      {error === "empty" && (
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

      {error === "server" && (
        <div
          className="card"
          style={{
            marginTop: 12,
            border: "1px solid rgba(239,68,68,.35)",
            background: "rgba(239,68,68,.08)",
            fontWeight: 600,
          }}
        >
          Une erreur est survenue côté serveur (clé API manquante). Réessaie plus tard.
        </div>
      )}

      {error === "send" && (
        <div
          className="card"
          style={{
            marginTop: 12,
            border: "1px solid rgba(239,68,68,.35)",
            background: "rgba(239,68,68,.08)",
            fontWeight: 600,
          }}
        >
          Impossible d&apos;envoyer ton avis pour le moment 😕 Réessaie un peu plus tard.
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
