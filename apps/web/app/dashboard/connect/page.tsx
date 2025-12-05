//apps/web/app/dashboard/connect/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Section } from "@/components/ui/Page";

import { fetchRecentActivities, fmtKm, fmtPaceOrSpeed, fmtDate } from "@/lib/strava";
import {
  readAppleRecent,
  fmtAppleType,
  fmtAppleDate,
  fmtDuration,
  fmtKm as fmtKmApple,
} from "@/lib/apple";
import {
  fetchGfRecentActivities,
  readGfRecentFromCookie,
  fmtKm as fmtKmGf,
  fmtDate as fmtDateGf,
} from "@/lib/google-fit";

import { translations } from "@/app/i18n/translations"; // ✅ i18n

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
  {
    id: "apple-health",
    name: "Apple Santé",
    subtitle: "iPhone / Apple Watch",
    status: "available",
    icon: "",
  },
  {
    id: "google-fit",
    name: "Google Fit",
    subtitle: "Android / WearOS",
    status: "available",
    icon: "🤖",
    connectHref: "/api/oauth/google-fit/start",
    disconnectPath: "/api/oauth/google-fit/disconnect",
    cookieFlag: "conn_google_fit",
  },
  {
    id: "garmin",
    name: "Garmin",
    subtitle: "Montres GPS",
    status: "coming-soon",
    icon: "⌚️",
    connectHref: "/api/oauth/garmin/start",
  },
  {
    id: "fitbit",
    name: "Fitbit",
    subtitle: "Capteurs & sommeil",
    status: "coming-soon",
    icon: "💠",
    connectHref: "/api/oauth/fitbit/start",
  },
  {
    id: "withings",
    name: "Withings",
    subtitle: "Balances & santé",
    status: "coming-soon",
    icon: "⚖️",
    connectHref: "/api/oauth/withings/start",
  },
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
  searchParams?: {
    subscribed?: string;
    unsubscribed?: string;
    connected?: string;
    disconnected?: string;
    error?: string;
  };
}) {
  const lang = getLang();
  const t = (path: string, fallback?: string) => tServer(lang, path, fallback);

  const searchParams = props?.searchParams ?? {};
  const jar = cookies();
  const isSubscribed = jar.get("app_notify_integrations")?.value === "1";
  const isStravaConnected = jar.get("conn_strava")?.value === "1";
  const isAppleConnected = jar.get("conn_apple_health")?.value === "1";
  const isGoogleFitConnected = jar.get("conn_google_fit")?.value === "1";

  const stravaEmptyText = t(
    "connect.strava.empty",
    "Aucune activité récente trouvée (ou accès non autorisé)."
  );
  const appleEmptyText = t(
    "connect.apple.empty",
    "Aucune activité trouvée dans l’export."
  );
  const elevationSuffix = t("connect.strava.elevationSuffix", "m D+");
  const appleBadgeSource = t("connect.apple.badgeSource", "Apple");
  const appleKcalSuffix = t("connect.apple.kcalSuffix", "kcal");

  return (
    <div
      className="container"
      style={{
        paddingTop: 24,
        paddingBottom: 32,
        fontSize: "var(--settings-fs, 12px)",
      }}
    >
      {/* Header */}
      <div className="page-header">
        <div>
          <h1
            className="h1"
            style={{ fontSize: "clamp(20px, 2.2vw, 24px)", lineHeight: 1.15 }}
          >
            {t("connect.page.title", "Connecte tes données")}
          </h1>
          <p
            className="lead"
            style={{
              fontSize: "clamp(12px, 1.6vw, 14px)",
              lineHeight: 1.35,
            }}
          >
            {t(
              "connect.page.subtitle",
              "Santé, capteurs, etc. — synchronise automatiquement tes activités et mesures."
            )}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {(searchParams.subscribed ||
        searchParams.unsubscribed ||
        searchParams.connected ||
        searchParams.disconnected ||
        searchParams.error) && (
        <div className="space-y-3">
          {searchParams.connected && (
            <div
              className="card"
              style={{
                border: "1px solid rgba(16,185,129,.35)",
                background: "rgba(16,185,129,.08)",
                fontWeight: 600,
              }}
            >
              {t(
                "connect.alerts.connected",
                "✓ {{name}} connecté."
              ).replace("{{name}}", searchParams.connected)}
            </div>
          )}
          {searchParams.disconnected && (
            <div
              className="card"
              style={{
                border: "1px solid rgba(107,114,128,.35)",
                background: "rgba(107,114,128,.08)",
                fontWeight: 600,
              }}
            >
              {t(
                "connect.alerts.disconnected",
                "{{name}} déconnecté."
              ).replace("{{name}}", searchParams.disconnected)}
            </div>
          )}
          {searchParams.subscribed && (
            <div
              className="card"
              style={{
                border: "1px solid rgba(16,185,129,.35)",
                background: "rgba(16,185,129,.08)",
                fontWeight: 600,
              }}
            >
              {t(
                "connect.alerts.subscribed",
                "✓ Nous te préviendrons dès qu’une intégration sera disponible."
              )}
            </div>
          )}
          {searchParams.unsubscribed && (
            <div
              className="card"
              style={{
                border: "1px solid rgba(107,114,128,.35)",
                background: "rgba(107,114,128,.08)",
                fontWeight: 600,
              }}
            >
              {t(
                "connect.alerts.unsubscribed",
                "Prévenez-moi désactivé."
              )}
            </div>
          )}
          {searchParams.error && (
            <div
              className="card"
              style={{
                border: "1px solid rgba(239,68,68,.35)",
                background: "rgba(239,68,68,.08)",
                fontWeight: 600,
              }}
            >
              {t("connect.alerts.errorPrefix", "⚠️ Erreur :")}{" "}
              {searchParams.error}
            </div>
          )}
        </div>
      )}

      {/* Intégrations */}
      <div className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2>{t("connect.sections.integrations", "Intégrations")}</h2>
        </div>

        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONS.map((it) => {
            const isConnected = it.cookieFlag
              ? jar.get(it.cookieFlag)?.value === "1"
              : false;
            const connName = it.cookieName
              ? jar.get(it.cookieName)?.value
              : undefined;
            const nameSuffix = connName ? ` : ${connName}` : "";

            const statusLabel = isConnected
              ? t("connect.statusBadge.connected", "Connecté")
              : it.status === "available"
              ? t("connect.statusBadge.available", "Disponible")
              : t("connect.statusBadge.comingSoon", "À venir");

            const isStrava = it.id === "strava";
            const isApple = it.id === "apple-health";
            const isGoogleFit = it.id === "google-fit";

            const stravaDescConnected = t(
              "connect.integrations.strava.descConnected",
              "Compte relié. Les activités récentes pourront être importées."
            );
            const stravaDescDisconnected = t(
              "connect.integrations.strava.descDisconnected",
              "Connexion sécurisée via OAuth pour lire tes activités."
            );

            const appleDesc = t(
              "connect.integrations.appleHealth.desc",
              "Importe ton export.zip pour afficher tes activités (pas d’OAuth Apple sur le Web)."
            );
            const appleNote = t(
              "connect.integrations.appleHealth.smallNote",
              "(Import depuis Profil)"
            );

            const gfDescConnected = t(
              "connect.integrations.googleFit.descConnected",
              "Compte Google Fit relié. Les sessions récentes peuvent être lues (lecture seule)."
            );
            const gfDescDisconnected = t(
              "connect.integrations.googleFit.descDisconnected",
              "Connexion sécurisée via OAuth pour lire tes sessions Google Fit."
            );

            const genericDesc = t(
              "connect.integrations.generic.descComingSoon",
              "Bientôt : connexion sécurisée via OAuth. Tes données restent sous ton contrôle."
            );

            const connectLabel = t("connect.buttons.connect", "Connecter");
            const disconnectLabel = t(
              "connect.buttons.disconnect",
              "Déconnecter"
            );
            const learnMoreLabel = t(
              "connect.buttons.learnMore",
              "En savoir plus"
            );
            const comingSoonTitle = t(
              "connect.buttons.comingSoonTitle",
              "Bientôt disponible"
            );

            return (
              <article
                key={it.id}
                className="card p-3 sm:p-4"
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span aria-hidden className="shrink-0">
                        {it.icon ?? "🔗"}
                      </span>
                      <h3
                        className="font-semibold text-sm sm:text-base truncate"
                        style={{ margin: 0 }}
                      >
                        {/* On garde it.name pour ne pas exploser la config,
                            mais tu peux aussi le sortir dans les translations si tu veux */}
                        {it.name}
                      </h3>
                    </div>
                    {it.subtitle && (
                      <div
                        className="text-xs sm:text-sm"
                        style={{ color: "var(--muted)", marginTop: 4 }}
                      >
                        {it.subtitle}
                      </div>
                    )}
                  </div>
                  <span className="badge text-xs sm:text-sm shrink-0">
                    {statusLabel}
                  </span>
                </div>

                <p
                  className="text-xs sm:text-sm"
                  style={{ color: "var(--muted)" }}
                >
                  {isStrava ? (
                    isConnected ? (
                      <>
                        {stravaDescConnected}
                        {nameSuffix}
                      </>
                    ) : (
                      stravaDescDisconnected
                    )
                  ) : isApple ? (
                    appleDesc
                  ) : isGoogleFit ? (
                    isConnected ? gfDescConnected : gfDescDisconnected
                  ) : (
                    genericDesc
                  )}
                </p>

                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  {/* Strava */}
                  {isStrava &&
                    (it.status === "available" ? (
                      isConnected ? (
                        <form
                          method="POST"
                          action={
                            it.disconnectPath ||
                            "/api/oauth/strava/disconnect"
                          }
                          className="w-full sm:w-auto"
                        >
                          <button
                            className="btn btn-outline w-full sm:w-auto"
                            type="submit"
                            style={{ color: "#111" }}
                          >
                            {disconnectLabel}
                          </button>
                        </form>
                      ) : (
                        <a
                          className="btn-dash w-full sm:w-auto text-center"
                          href={it.connectHref}
                        >
                          {connectLabel}
                        </a>
                      )
                    ) : (
                      <>
                        <button
                          className="btn-dash w-full sm:w-auto"
                          type="button"
                          disabled
                          title={comingSoonTitle}
                        >
                          {connectLabel}
                        </button>
                        <button
                          className="btn btn-outline w-full sm:w-auto"
                          type="button"
                          disabled
                          title={comingSoonTitle}
                          style={{ color: "#111" }}
                        >
                          {learnMoreLabel}
                        </button>
                      </>
                    ))}

                  {/* Apple Santé — on garde le texte d’info mais plus de bloc d’upload plus bas */}
                  {isApple && (
                    <span
                      className="text-xs sm:text-sm"
                      style={{ color: "var(--muted)" }}
                    >
                      {appleNote}
                    </span>
                  )}

                  {/* Google Fit */}
                  {isGoogleFit &&
                    (it.status === "available" ? (
                      isConnected ? (
                        <form
                          method="POST"
                          action={
                            it.disconnectPath ||
                            "/api/oauth/google-fit/disconnect"
                          }
                          className="w-full sm:w-auto"
                        >
                          <button
                            className="btn btn-outline w-full sm:w-auto"
                            type="submit"
                            style={{ color: "#111" }}
                          >
                            {disconnectLabel}
                          </button>
                        </form>
                      ) : (
                        <a
                          className="btn-dash w-full sm:w-auto text-center"
                          href={it.connectHref}
                        >
                          {connectLabel}
                        </a>
                      )
                    ) : (
                      <>
                        <button
                          className="btn-dash w-full sm:w-auto"
                          type="button"
                          disabled
                          title={comingSoonTitle}
                        >
                          {connectLabel}
                        </button>
                        <button
                          className="btn btn-outline w-full sm:w-auto"
                          type="button"
                          disabled
                          title={comingSoonTitle}
                          style={{ color: "#111" }}
                        >
                          {learnMoreLabel}
                        </button>
                      </>
                    ))}

                  {/* Par défaut (Garmin, Fitbit, Withings…) */}
                  {!isStrava && !isApple && !isGoogleFit && (
                    <>
                      <button
                        className="btn-dash w-full sm:w-auto"
                        type="button"
                        disabled
                        title={comingSoonTitle}
                      >
                        {connectLabel}
                      </button>
                      <button
                        className="btn btn-outline w-full sm:w-auto"
                        type="button"
                        disabled
                        title={comingSoonTitle}
                        style={{ color: "#111" }}
                      >
                        {learnMoreLabel}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Dernières performances Strava */}
      {isStravaConnected && (
        <div className="section" style={{ marginTop: 12 }}>
          <div className="section-head" style={{ marginBottom: 8 }}>
            <h2>
              {t(
                "connect.sections.stravaTitle",
                "Dernières performances (Strava)"
              )}
            </h2>
          </div>
          {await (async () => {
            const acts = await fetchRecentActivities(6);
            if (!acts.length) {
              return (
                <div
                  className="card text-xs sm:text-sm"
                  style={{ color: "var(--muted)" }}
                >
                  {stravaEmptyText}
                </div>
              );
            }
            return (
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {acts.map((a) => (
                  <article
                    key={a.id}
                    className="card p-3 sm:p-4"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <h3
                        className="font-semibold text-sm sm:text-base truncate"
                        style={{ margin: 0 }}
                      >
                        {a.name || a.type}
                      </h3>
                      <span className="badge text-xs sm:text-sm">
                        {a.type}
                      </span>
                    </div>
                    <div
                      className="text-xs sm:text-sm"
                      style={{ color: "var(--muted)" }}
                    >
                      {fmtDate(a.start_date_local)}
                    </div>
                    <div
                      className="text-xs sm:text-sm"
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span className="badge">{fmtKm(a.distance)}</span>
                      <span className="badge">
                        {fmtPaceOrSpeed(a)}
                      </span>
                      {a.total_elevation_gain ? (
                        <span className="badge">
                          {Math.round(a.total_elevation_gain)}{" "}
                          {elevationSuffix}
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Dernières performances Apple Santé */}
      {isAppleConnected && (
        <div className="section" style={{ marginTop: 12 }}>
          <div className="section-head" style={{ marginBottom: 8 }}>
            <h2>
              {t(
                "connect.sections.appleTitle",
                "Dernières performances (Apple Santé)"
              )}
            </h2>
          </div>
          {(() => {
            const acts = readAppleRecent();
            if (!acts.length) {
              return (
                <div
                  className="card text-xs sm:text-sm"
                  style={{ color: "var(--muted)" }}
                >
                  {appleEmptyText}
                </div>
              );
            }
            return (
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {acts.map((a, idx) => (
                  <article
                    key={idx}
                    className="card p-3 sm:p-4"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <h3
                        className="font-semibold text-sm sm:text-base truncate"
                        style={{ margin: 0 }}
                      >
                        {fmtAppleType(a.type)}
                      </h3>
                      <span className="badge text-xs sm:text-sm">
                        {appleBadgeSource}
                      </span>
                    </div>
                    <div
                      className="text-xs sm:text-sm"
                      style={{ color: "var(--muted)" }}
                    >
                      {fmtAppleDate(a.start)}
                    </div>
                    <div
                      className="text-xs sm:text-sm"
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {fmtKmApple(a.distanceKm) && (
                        <span className="badge">
                          {fmtKmApple(a.distanceKm)}
                        </span>
                      )}
                      {fmtDuration(a.duration) && (
                        <span className="badge">
                          {fmtDuration(a.duration)}
                        </span>
                      )}
                      {a.energyKcal ? (
                        <span className="badge">
                          {Math.round(a.energyKcal)} {appleKcalSuffix}
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Alerte de dispo */}
      <div className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2>
            {t("connect.sections.alertTitle", "Recevoir une alerte")}
          </h2>
        </div>
        <div
          className="card p-3 sm:p-4"
          style={{
            display: "flex",
            alignItems: "stretch",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div className="min-w-0">
            <strong className="text-sm sm:text-base block">
              {t(
                "connect.alert.title",
                "Préviens-moi quand les intégrations arrivent"
              )}
            </strong>
            <div
              className="text-xs sm:text-sm"
              style={{ color: "var(--muted)" }}
            >
              {t(
                "connect.alert.subtitle",
                "Notification dans l’app (préférence stockée en local)."
              )}
            </div>
          </div>

          <form
            action={subscribeAction}
            className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto"
          >
            <input
              type="hidden"
              name="want"
              value={isSubscribed ? "0" : "1"}
            />
            {isSubscribed ? (
              <button
                className="btn btn-outline w-full sm:w-auto"
                type="submit"
                style={{ color: "#111" }}
              >
                {t("connect.buttons.disable", "Désactiver")}
              </button>
            ) : (
              <button
                className="btn-dash"
                type="submit"
                style={{
                  padding: "6px 10px",
                  lineHeight: 1.2,
                  alignSelf: "center",
                }}
              >
                {t("connect.buttons.notifyMe", "Me prévenir")}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
