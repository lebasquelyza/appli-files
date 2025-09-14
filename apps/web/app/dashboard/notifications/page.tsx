import { useState } from "react";
import { PageHeader, Section } from "@/components/ui/Page";

export default function Page() {
  // (optionnel) état local, prêt à brancher plus tard
  const [remindersOn] = useState(false);

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Motivation Files ou tes messages"
      />

      <Section title="Réglages">
        <div className="space-y-6">
          {/* Intro */}
          <div className="card">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Configure tes rappels pour rester motivé·e. Les envois par email et les
              messages personnalisés arrivent bientôt.
            </p>
          </div>

          {/* Grille principale */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Rappels de progression */}
            <div className="card space-y-4">
              <div className="space-y-1.5">
                <h3 className="font-semibold">Rappels de progression</h3>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Reçois un rappel doux pour rester sur ta lancée.
                </p>
              </div>

              {/* Switch (placeholder, désactivé pour l’instant) */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled
                  className="relative inline-flex h-8 w-[60px] cursor-not-allowed items-center rounded-full px-1"
                  title="Bientôt disponible"
                  style={{
                    background: "rgba(0,0,0,.08)",
                    border: "1px solid rgba(0,0,0,.10)",
                  }}
                >
                  <span
                    className="inline-block h-6 w-6 rounded-full"
                    style={{
                      transform: remindersOn ? "translateX(28px)" : "translateX(0)",
                      background: "var(--bg)",
                      boxShadow: "var(--shadow)",
                      transition: "transform .2s ease",
                    }}
                  />
                </button>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  Bientôt
                </span>
              </div>

              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Astuce : tu pourras choisir la fréquence (quotidienne, hebdo) et l’heure.
              </p>
            </div>

            {/* Aperçu d’un message */}
            <div className="card space-y-4">
              <h3 className="font-semibold">Aperçu d’un message</h3>

              <div
                className="rounded-xl p-4"
                style={{
                  background: "var(--panel)",
                  border: "1px solid rgba(0,0,0,.06)",
                }}
              >
                <p className="text-sm leading-relaxed">
                  👋 Coucou ! Petit rappel motivation : 10 minutes de plus et tu fais
                  une super différence. Tu t’y remets maintenant ?
                </p>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <span
                  className="inline-block rounded-md px-2 py-1"
                  style={{
                    background: "var(--panel)",
                    border: "1px solid rgba(0,0,0,.06)",
                  }}
                >
                  09:00
                </span>
                <span style={{ color: "var(--muted)" }}>
                  Heure de rappel par défaut
                </span>
              </div>
            </div>
          </div>

          {/* Messages personnalisés */}
          <div className="card space-y-2">
            <h3 className="font-semibold">Messages personnalisés</h3>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Bientôt : écris tes propres phrases de motivation et choisis à quels
              moments les recevoir (emails, notifications).
            </p>
          </div>

          {/* CTA */}
          <div className="card flex items-center justify-between gap-4">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Tu veux être notifié·e quand ces options arrivent ?
            </p>
            <button type="button" className="btn-dash">Me prévenir</button>
          </div>
        </div>
      </Section>
    </>
  );
}
