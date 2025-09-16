import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";

import { fetchRecentActivities, fmtKm, fmtPaceOrSpeed, fmtDate } from "@/lib/strava";
import {
  readAppleRecent,
  fmtAppleType,
  fmtAppleDate,
  fmtDuration,
  fmtKm as fmtKmApple,
} from "@/lib/apple";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Status = "coming-soon" | "available";
type Integration = {
  id: string;
  name: string;
  subtitle?: string;
  status: Status;
  icon?: string;
  connectHref?: string;
  disconnectPath?: string;
  cookieFlag?: string;
  cookieName?: string;
};

const INTEGRATIONS: Integration[] = [
  {
    id: "strava",
    name: "Strava",
    subtitle: "Course, vélo, activités",
    status: "available",
    icon: "🟧",
    connectHref: "/api/oauth/strava/start",
    disconnectPath: "/api/oauth/strava/disconnect",
    cookieFlag: "conn_strava",
    cookieName: "conn_strava_name",
  },
  // Apple Santé disponible (import export.zip)
  { id: "apple-health", name: "Apple Santé", subtitle: "iPhone / Apple Watch", status: "available", icon: "" },

  // À venir
  { id: "google-fit",  name: "Google Fit",  subtitle: "Android / WearOS",     status: "coming-soon", icon: "🤖", connectHref: "/api/oauth/google-fit/start" },
  { id: "garmin",      name: "Garmin",      subtitle: "Montres GPS",          status: "coming-soon", icon: "⌚️", connectHref: "/api/oauth/garmin/start" },
  { id: "fitbit",      name: "Fitbit",      subtitle: "Capteurs & sommeil",   status: "coming-soon", icon: "💠", connectHref: "/api/oauth/fitbit/start" },
  { id: "withings",    name: "Withings",    subtitle: "Balances & santé",     status: "coming-soon", icon: "⚖️", connectHref: "/api/oauth/withings/start" },
];

/* ---------- Server Action : abonnement à l’alerte intégrations ---------- */
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
export default async function Page(props: {
  searchParams?: { subscribed?: string; unsubscribed?: string; connected?: string; disconnected?: string; error?: string };
}) {
  const searchParams = props?.searchParams ?? {};
  const jar = cookies();
  const isSubscribed = jar.get("app_notify_integrations")?.value === "1";
  const isStravaConnected = jar.get("conn_strava")?.value === "1";
  const isAppleConnected = jar.get("conn_apple_health")?.value === "1";

  return (
    <>
      <PageHeader
        title="Connecte tes données"
        subtitle="Santé, capteurs, etc. — synchronise automatiquement tes activités et mesures."
      />

      {(searchParams.subscribed ||
        searchParams.unsubscribed ||
        searchParams.connected ||
        searchParams.disconnected ||
        searchParams.error) && (
        <Section title=" ">
          {searchParams.connected && (
            <div className="card" style={{ border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", fontWeight: 600 }}>
              ✓ {searchParams.connected} connecté.
            </div>
          )}
          {searchParams.disconnected && (
            <div className="card" style={{ border: "1px solid rgba(107,114,128,.35)", background: "rgba(107,114,128,.08)", fontWeight: 600 }}>
              {searchParams.disconnected} déconnecté.
            </div>
          )}
          {searchParams.subscribed && (
            <div className="card" style={{ border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", fontWeight: 600 }}>
              ✓ Nous te préviendrons dès qu’une intégration sera disponible.
            </div>
          )}
          {searchParams.unsubscribed && (
            <div className="card" style={{ border: "1px solid rgba(107,114,128,.35)", background: "rgba(107,114,128,.08)", fontWeight: 600 }}>
              Prévenez-moi désactivé.
            </div>
          )}
          {searchParams.error && (
            <div className="card" style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600 }}>
              ⚠️ Erreur : {searchParams.error}
            </div>
          )}
        </Section>
      )}

      {/* Intégrations */}
      <Section title="Intégrations">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONS.map((it) => {
            const isConnected = it.cookieFlag ? jar.get(it.cookieFlag)?.value === "1" : false;
            const connName = it.cookieName ? jar.get(it.cookieName)?.value : undefined;
            const nameSuffix = connName ? ` : ${connName}` : "";

            return (
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
                  <span className="badge">{isConnected ? "Connecté" : it.status === "available" ? "Disponible" : "À venir"}</span>
                </div>

                {/* Description par intégration */}
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {it.id === "strava" ? (
                    isConnected
                      ? <>Compte relié{nameSuffix}. Les activités récentes pourront être importées.</>
                      : <>Connexion sécurisée via OAuth pour lire tes activités.</>
                  ) : it.id === "apple-health" ? (
                    <>Importe ton <b>export.zip</b> pour afficher tes activités (pas d’OAuth Apple sur le Web).</>
                  ) : (
                    <>Bientôt : connexion sécurisée via OAuth. Tes données restent sous ton contrôle.</>
                  )}
                </p>

                {/* Actions par intégration */}
                <div className="flex gap-2">
                  {/* Strava */}
                  {it.id === "strava" && (
                    it.status === "available" ? (
                      isConnected ? (
                        <form method="POST" action={it.disconnectPath || "/api/oauth/strava/disconnect"}>
                          <button className="btn btn-outline" type="submit" style={{ color: "#111" }}>
                            Déconnecter
                          </button>
                        </form>
                      ) : (
                        <a className="btn-dash" href={it.connectHref}>Connecter</a>
                      )
                    ) : (
                      <>
                        <button className="btn-dash" type="button" disabled title="Bientôt disponible">Connecter</button>
                        <button className="btn btn-outline" type="button" disabled title="Bientôt disponible" style={{ color: "#111" }}>
                          En savoir plus
                        </button>
                      </>
                    )
                  )}

                  {/* Apple Santé */}
                  {it.id === "apple-health" && (
                    <a className="btn-dash" href="#apple-import">Importer export.zip</a>
                  )}

                  {/* Par défaut : à venir */}
                  {it.id !== "strava" && it.id !== "apple-health" && (
                    <>
                      <button className="btn-dash" type="button" disabled title="Bientôt disponible">Connecter</button>
                      <button className="btn btn-outline" type="button" disabled title="Bientôt disponible" style={{ color: "#111" }}>
                        En savoir plus
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      {/* Dernières performances Strava */}
      {isStravaConnected && (
        <Section title="Dernières performances (Strava)">
          {/** On récupère côté serveur (RSC) */}
          {await (async () => {
            const acts = await fetchRecentActivities(6);
            if (!acts.length) {
              return (
                <div className="card text-sm" style={{ color: "var(--muted)" }}>
                  Aucune activité récente trouvée (ou accès non autorisé).
                </div>
              );
            }
            return (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {acts.map((a) => (
                  <article key={a.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold" style={{ margin: 0 }}>{a.name || a.type}</h3>
                      <span className="badge">{a.type}</span>
                    </div>
                    <div className="text-sm" style={{ color: "var(--muted)" }}>{fmtDate(a.start_date_local)}</div>
                    <div className="text-sm" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span className="badge">{fmtKm(a.distance)}</span>
                      <span className="badge">{fmtPaceOrSpeed(a)}</span>
                      {a.total_elevation_gain ? <span className="badge">{Math.round(a.total_elevation_gain)} m D+</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            );
          })()}
        </Section>
      )}

      {/* Importer depuis Apple Santé */}
      <Section title="Importer depuis Apple Santé (export.zip)">
        <div
          id="apple-import"
          className="card"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
        >
          <div>
            <strong>Importer un export Apple Santé</strong>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              Sur iPhone : Santé → Profil → <b>Exporter toutes les données</b> → partage le <b>export.zip</b>,
              puis importe-le ici.
            </div>
          </div>

          <form
            method="POST"
            action="/api/apple-health/import"
            encType="multipart/form-data"
            className="flex items-center gap-2"
          >
            <input type="file" name="file" accept=".zip" required className="text-sm" />
            <button className="btn-dash" type="submit">Importer</button>
          </form>
        </div>
      </Section>

      {/* Dernières performances Apple Santé */}
      {isAppleConnected && (
        <Section title="Dernières performances (Apple Santé)">
          {(() => {
            const acts = readAppleRecent();
            if (!acts.length) {
              return (
                <div className="card text-sm" style={{ color: "var(--muted)" }}>
                  Aucune activité trouvée dans l’export.
                </div>
              );
            }
            return (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {acts.map((a, idx) => (
                  <article
                    key={idx}
                    className="card"
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold" style={{ margin: 0 }}>
                        {fmtAppleType(a.type)}
                      </h3>
                      <span className="badge">Apple</span>
                    </div>

                    <div className="text-sm" style={{ color: "var(--muted)" }}>
                      {fmtAppleDate(a.start)}
                    </div>

                    <div className="text-sm" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {fmtKmApple(a.distanceKm) && (
                        <span className="badge">{fmtKmApple(a.distanceKm)}</span>
                      )}
                      {fmtDuration(a.duration) && (
                        <span className="badge">{fmtDuration(a.duration)}</span>
                      )}
                      {a.energyKcal ? (
                        <span className="badge">{Math.round(a.energyKcal)} kcal</span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            );
          })()}
        </Section>
      )}

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
    </>
  );
}
