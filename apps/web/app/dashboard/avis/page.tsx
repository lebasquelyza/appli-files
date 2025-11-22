// apps/web/app/dashboard/avis/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { translations } from "@/app/i18n/translations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ========== i18n helpers (server) ========== */
type Lang = "fr" | "en";

function getFromPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function tServer(lang: Lang, path: string, fallback?: string): string {
  const dict = translations[lang] as any;
  const v = getFromPath(dict, path);
  if (typeof v === "string") return v;
  return fallback ?? path;
}

function getLang(): Lang {
  const cookieLang = cookies().get("fc-lang")?.value;
  if (cookieLang === "en") return "en";
  return "fr";
}

/** Server Action : envoie l'avis via l'API Resend (comme /api/auth/send-reset) */
async function sendFeedback(formData: FormData) {
  "use server";

  const messageRaw = formData.get("feedback");
  const emailRaw = formData.get("email");

  const message = (messageRaw ?? "").toString().trim();
  const email = (emailRaw ?? "").toString().trim();

  if (!message) {
    redirect("/dashboard/avis?error=empty");
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[avis] RESEND_API_KEY manquante");
    redirect("/dashboard/avis?error=server");
  }

  const safeMessage = message.replace(/</g, "&lt;");
  const safeEmail = email.replace(/</g, "&lt;");

  const emailBlock = email
    ? `
      <p style="margin:0 0 12px 0;font-size:14px;">
        <strong>Email du client :</strong> ${safeEmail}
      </p>
    `
    : `
      <p style="margin:0 0 12px 0;font-size:12px;color:#6b7280;font-style:italic;">
        Email non renseigné
      </p>
    `;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Files Coaching <no-reply@appli.files-coaching.com>",
        to: "sportifandpro@gmail.com",
        subject: "Nouvel avis utilisateur",
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#111">Nouvel avis utilisateur</h2>
            <p>Un utilisateur a envoyé un avis depuis l'app Files Coaching :</p>

            ${emailBlock}

            <div style="margin:16px 0;padding:12px 14px;border-radius:8px;background:#f3f4f6;white-space:pre-wrap;">
              ${safeMessage}
            </div>

            <hr style="border:none;border-top:1px solid #eee;margin:18px 0"/>
            <p style="font-size:12px;color:#888">
              Cet e-mail a été généré automatiquement par la page &laquo; Votre avis &raquo;.
            </p>
          </div>
        `.trim(),
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      console.error("[avis] Resend API error:", resp.status, txt);
      redirect("/dashboard/avis?error=send");
    }
  } catch (e) {
    console.error("[avis] fetch vers Resend a échoué:", e);
    redirect("/dashboard/avis?error=send");
  }

  redirect("/dashboard/avis?sent=1");
}

export default function Page({
  searchParams,
}: {
  searchParams?: { sent?: string; error?: string };
}) {
  const lang = getLang();
  const t = (path: string, fallback?: string) => tServer(lang, path, fallback);

  const sent = searchParams?.sent === "1";
  const error = searchParams?.error;

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      {/* En-tête */}
      <div className="page-header">
        <div>
          <h1 className="h1" style={{ fontSize: 22 }}>
            {t("avis.title", "Votre avis")}
          </h1>
          <p className="lead" style={{ fontSize: 13, marginTop: 4 }}>
            {t(
              "avis.lead",
              "Dis-nous ce que tu penses de l’app pour qu’on puisse l’améliorer 🙌"
            )}
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
          {t(
            "avis.messages.sent",
            "Merci pour ton avis 🙏 On lit tous les messages avec attention."
          )}
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
          {t(
            "avis.messages.empty",
            "Oups 😅 Merci d'écrire un petit message avant d'envoyer."
          )}
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
          {t(
            "avis.messages.server",
            "Une erreur est survenue côté serveur (configuration e-mail). Réessaie plus tard."
          )}
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
          {t(
            "avis.messages.send",
            "Impossible d'envoyer ton avis pour le moment 😕 Réessaie un peu plus tard."
          )}
        </div>
      )}

      {/* Formulaire */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="card">
          <form action={sendFeedback}>
            {/* Champ email */}
            <label
              htmlFor="email"
              className="label"
              style={{ display: "block", fontWeight: 700, marginBottom: 6 }}
            >
              {t(
                "avis.form.email.label",
                "Ton e-mail (si tu veux qu'on te réponde)"
              )}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              style={{ width: "100%", marginBottom: 12 }}
              placeholder={t(
                "avis.form.email.placeholder",
                "ton.email@exemple.com"
              )}
            />

            {/* Champ message */}
            <label
              htmlFor="feedback"
              className="label"
              style={{ display: "block", fontWeight: 700, marginBottom: 6 }}
            >
              {t("avis.form.message.label", "Ton message")}
            </label>

            <textarea
              id="feedback"
              name="feedback"
              rows={6}
              className="input"
              style={{ width: "100%", resize: "vertical" }}
              placeholder={t(
                "avis.form.message.placeholder",
                "Dis-nous ce qui te plaît, ce qu’on peut améliorer, des idées de fonctionnalités..."
              )}
            />

            <button
              type="submit"
              className="btn btn-dash"
              style={{ marginTop: 12, fontWeight: 700 }}
            >
              {t("avis.form.submit", "Envoyer mon avis")}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
