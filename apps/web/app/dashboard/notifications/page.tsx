import { PageHeader, Section } from "@/components/ui/Page";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Motivation Files ou tes messages"
      />

      <Section title="Réglages">
        <div className="space-y-6">
          {/* Bandeau d'intro */}
          <div
            className="rounded-2xl p-5"
            style={{
              background:
                "linear-gradient(135deg, rgba(99,102,241,.12), rgba(16,185,129,.10))",
              border: "1px solid rgba(0,0,0,.06)",
              boxShadow: "0 6px 20px rgba(0,0,0,.06)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Configure tes rappels pour rester motivé·e. Les envois par email
              et les messages personnalisés arrivent bientôt.
            </p>
          </div>

          {/* Grille de cartes */}
          <div className="grid gap-5 md:grid-cols-2">
            {/* Carte: Rappels (placeholder activable bientôt) */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-4"
              style={{
                background: "var(--bg)",
                border: "1px solid rgba(0,0,0,.08)",
                boxShadow: "var(--shadow)",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-grid place-items-center rounded-xl"
                  style={{
                    width: 40,
                    height: 40,
                    background:
                      "linear-gradient(135deg,rgba(59,130,246,.18),rgba(59,130,246,.08))",
                    border: "1px solid rgba(59,130,246,.25)",
                  }}
                >
                  {/* icône cloche */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22ZM20 17h-1V11a7 7 0 1 0-14 0v6H4a1 1 0 0 0 0 2h16a1 1 0 1 0 0-2Z" />
                  </svg>
                </span>
                <div>
                  <div className="font-semibold">Rappels de progression</div>
                  <div className="text-sm" style={{ color: "var(--muted)" }}>
                    Reçois un rappel doux pour rester sur ta lancée.
                  </div>
                </div>
              </div>

              {/* Switch non-fonctionnel (à brancher plus tard) */}
              <button
                type="button"
                disabled
                className="relative inline-flex h-9 w-[66px] cursor-not-allowed select-none items-center rounded-full px-1"
                title="Bientôt disponible"
                style={{
                  background: "rgba(0,0,0,.08)",
                  border: "1px solid rgba(0,0,0,.10)",
                }}
              >
                <span
                  className="inline-block h-7 w-7 rounded-full transition-transform"
                  style={{
                    transform: "translateX(0)",
                    background: "linear-gradient(135deg,#fff,rgba(255,255,255,.85))",
                    boxShadow: "0 4px 12px rgba(0,0,0,.12)",
                  }}
                />
                <span className="ml-2 text-xs" style={{ color: "var(--muted)" }}>
                  Bientôt
                </span>
              </button>

              <div className="text-xs" style={{ color: "var(--muted)" }}>
                Astuce : tu pourras choisir la fréquence (quotidienne, hebdo) et l’heure.
              </div>
            </div>

            {/* Carte: Aperçu de message */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-4"
              style={{
                background:
                  "linear-gradient(135deg, rgba(236,72,153,.10), rgba(99,102,241,.10))",
                border: "1px solid rgba(0,0,0,.06)",
                boxShadow: "0 6px 20px rgba(0,0,0,.06)",
              }}
            >
              <div className="font-semibold">Aperçu d’un message</div>
              <div
                className="rounded-xl p-4"
                style={{
                  background: "rgba(255,255,255,.65)",
                  border: "1px solid rgba(0,0,0,.06)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <div className="text-sm leading-relaxed">
                  👋 Coucou&nbsp;! Petit rappel motivation&nbsp;: 10 minutes de plus et tu
                  fais une super différence. Tu t’y remets maintenant&nbsp;?
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <span
                  className="inline-block rounded-md px-2 py-1"
                  style={{
                    background: "rgba(0,0,0,.06)",
                    border: "1px solid rgba(0,0,0,.08)",
                  }}
                >
                  09:00
                </span>
                <span className="" style={{ color: "var(--muted)" }}>
                  Heure de rappel par défaut
                </span>
              </div>
            </div>
          </div>

          {/* Carte “À venir” */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "var(--bg)",
              border: "1px solid rgba(0,0,0,.08)",
              boxShadow: "var(--shadow)",
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="inline-grid place-items-center rounded-xl"
                style={{
                  width: 36,
                  height: 36,
                  background: "rgba(16,185,129,.12)",
                  border: "1px solid rgba(16,185,129,.25)",
                }}
              >
                {/* icône message */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H9l-5 5v-5H5a3 3 0 0 1-3-3V5Z" />
                </svg>
              </span>
              <div className="space-y-1">
                <div className="font-semibold">Messages personnalisés</div>
                <div className="text-sm" style={{ color: "var(--muted)" }}>
                  Bientôt&nbsp;: écris tes propres phrases de motivation et choisis à
                  quels moments les recevoir (emails, notifications).
                </div>
              </div>
            </div>
          </div>

          {/* Call-to-action doux */}
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              Tu veux être notifié·e quand ces options arrivent&nbsp;?
            </div>
            <button
              type="button"
              className="btn-dash"
              title="Me prévenir dès que c’est prêt"
            >
              Me prévenir
            </button>
          </div>
        </div>
      </Section>
    </>
  );
}
