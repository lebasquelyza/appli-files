import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Status = "coming-soon" | "available";
type Integration = {
  id: string;
  name: string;
  subtitle?: string;
  status: Status;
  icon?: string; // simple emoji pour l’instant
};

const INTEGRATIONS: Integration[] = [
  { id: "apple-health", name: "Apple Santé", subtitle: "iPhone / Apple Watch", status: "coming-soon", icon: "" },
  { id: "google-fit",  name: "Google Fit",  subtitle: "Android / WearOS",     status: "coming-soon", icon: "🤖" },
  { id: "strava",       name: "Strava",      subtitle: "Course, vélo, activités", status: "coming-soon", icon: "🟧" },
  { id: "garmin",       name: "Garmin",      subtitle: "Montres GPS",         status: "coming-soon", icon: "⌚️" },
  { id: "fitbit",       name: "Fitbit",      subtitle: "Capteurs & sommeil",  status: "coming-soon", icon: "💠" },
  { id: "withings",     name: "Withings",    subtitle: "Balances & santé",    status: "coming-soon", icon: "⚖️" },
];

/* ---------- Server Action: s’abonner à l’alerte intégrations ---------- */
async function subscribeAction(formData: FormData) {
  "use server";
  const want = (formData.get("want") || "").toString() === "1";
  const jar = cookies();
  jar.set("app_notify_integrations", want ? "1" : "0", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
  });
  redirect(`/dashboard/connect?${want ? "subscribed=1" : "unsubscribed=1"}`);
}

/* -------------------------------- Page -------------------------------- */
export default async function Page({ searchParams }: { searchParams?: { subscribed?: string; unsubscribed?: string } }) {
  const jar = cookies();
  const isSubscribed = jar.get("app_notify_integrations")?.value === "1";

  return (
    <>
      <PageHeader
        title="Connecte tes données"
        subtitle="Santé, capteurs, etc. — synchronise automatiquement tes activités et mesures."
      />

      {/* Messages */}
      {(searchParams?.subscribed || searchParams?.unsubscribed) && (
        <Section title=" ">
          {searchParams?.subscribed && (
            <div className="card" style={{ border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", fontWeight: 600 }}>
              ✓ Nous te préviendrons dès qu’une intégration sera disponible.
            </div>
          )}
          {searchParams?.unsubscribed && (
            <div className="card" style={{ border: "1px solid rgba(107,114,128,.35)", background: "rgba(107,114,128,.08)", fontWeight: 600 }}>
              Prévenez-moi désactivé.
            </div>
          )}
        </Section>
      )}

      {/* Intégrations */}
      <Section title="Intégrations">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONS.map((it) => (
            <article key={it.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span aria-hidden>{it.icon ?? "🔗"}</span>
                    <h3 className="font-semibold" style={{ margin: 0 }}>{it.name}</h3>
                  </div>
                  {it.subtitle && (
                    <div className="text-sm" style={{ color: "var(--muted)", marginTop: 4 }}>{it.subtitle}</div>
                  )}
                </div>
                <span className="badge">À venir</span>
              </div>

              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Bientôt : connexion sécurisée via OAuth. Tes données restent sous ton contrôle.
              </p>

              <div className="flex gap-2">
                <button className="btn-dash" type="button" disabled title="Bientôt disponible">
                  Connecter
                </button>
                <button className="btn btn-outline" type="button" disabled title="Bientôt disponible" style={{ color: "#111" }}>
                  En savoir plus
                </button>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* Alerte de dispo */}
      <Section title="Recevoir une alerte">
        <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <strong>Préviens-moi quand les intégrations arrivent</strong>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              Notification dans l’app (préférence stockée en local).
            </div>
          </div>

          <form action={subscribeAction} className="flex items-center gap-2">
            <input type="hidden" name="want" value={isSubscribed ? "0" : "1"} />
            {isSubscribed ? (
              <button className="btn btn-outline" type="submit" style={{ color: "#111" }}>
                Désactiver
              </button>
            ) : (
              <button className="btn-dash" type="submit">Me prévenir</button>
            )}
          </form>
        </div>
      </Section>

      {/* Mini-FAQ */}
      <Section title="FAQ">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="card">
            <h3 className="font-semibold" style={{ margin: 0 }}>Quelles données seront importées ?</h3>
            <p className="text-sm" style={{ color: "var(--muted)", marginTop: 6 }}>
              Activités (pas, cardio), séances, poids, sommeil (selon la source). Tu choisiras précisément quoi synchroniser.
            </p>
          </article>
          <article className="card">
            <h3 className="font-semibold" style={{ margin: 0 }}>Mes données restent-elles privées ?</h3>
            <p className="text-sm" style={{ color: "var(--muted)", marginTop: 6 }}>
              Oui. Connexion OAuth réversible à tout moment. Tes préférences restent locales.
            </p>
          </article>
        </div>
      </Section>
    </>
  );
}
