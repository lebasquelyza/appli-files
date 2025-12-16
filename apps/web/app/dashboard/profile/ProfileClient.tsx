//apps/web/app/dashboard/profile/ProfileClient.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import GenerateClient from "./GenerateClient";
import type {
  Profile as ProfileT,
  AiSession as AiSessionT,
} from "../../../lib/coach/ai";
import { AdBanner } from "@/components/AdBanner";

// ✅ NEW
import { syncDoneSessionsToCookie } from "@/lib/sessionsCookie";

type DebugInfo = { email: string; sheetHit: boolean; reason?: string };

type Props = {
  emailForDisplay: string;
  profile: Partial<ProfileT> | null;
  debugInfo: DebugInfo;
  forceBlank: boolean;
  hasGenerate: boolean;
  equipMode: "full" | "none";
  initialSessions: AiSessionT[];
  savedIds: string[];
  laterIds: string[];
  displayedError: string;
  displayedSuccess: string;
  showDebug: boolean;
  questionnaireUrl: string;
  questionnaireBase: string;
  lang?: "fr" | "en";
  showAdOnGenerate?: boolean; // 👈 flag venant de ?generate=1
};

/* Helpers côté client */
function parseIdListFromArray(list: string[] | undefined) {
  return new Set(list ?? []);
}
function sessionKey(_s: AiSessionT, idx: number) {
  return `s${idx}`;
}

export default function ProfileClient(props: Props) {
  const {
    emailForDisplay,
    profile,
    debugInfo,
    forceBlank,
    hasGenerate,
    equipMode,
    initialSessions,
    savedIds,
    laterIds,
    displayedError,
    displayedSuccess,
    showDebug,
    questionnaireUrl,
    questionnaireBase,
    showAdOnGenerate,
  } = props;

  const { t } = useLanguage();

  // 👉 état pour afficher la pub plein écran après clic sur "Générer"
  const [showAdOverlay, setShowAdOverlay] = useState(false);

  useEffect(() => {
    if (showAdOnGenerate) {
      setShowAdOverlay(true);

      const timer = setTimeout(() => {
        setShowAdOverlay(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [showAdOnGenerate]);

  // helper t avec fallback si la clé n’existe pas
  const tf = (path: string, fallback?: string) => {
    const v = t(path);
    if (v && v !== path) return v;
    return fallback ?? path;
  };

  const savedIdSet = useMemo(() => parseIdListFromArray(savedIds), [savedIds]);
  const laterIdSet = useMemo(() => parseIdListFromArray(laterIds), [laterIds]);

  const showPlaceholders = !forceBlank;
  const p = (profile ?? {}) as Partial<ProfileT>;

  const clientPrenom =
    typeof p?.prenom === "string" && p.prenom && !/\d/.test(p.prenom)
      ? p.prenom
      : "";
  const clientAge = typeof p?.age === "number" && p.age > 0 ? p.age : undefined;

  // goalLabel – utilise settings.profile.goal.labels.*
  const goalLabel = useMemo(() => {
    const g = String((p as any)?.objectif || (p as any)?.goal || "").toLowerCase();
    if (!g) return "";
    const key = `settings.profile.goal.labels.${g}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;

    // fallback FR “dur”
    const map: Record<string, string> = {
      hypertrophy: "Hypertrophie / Esthétique",
      fatloss: "Perte de gras",
      strength: "Force",
      endurance: "Endurance / Cardio",
      mobility: "Mobilité / Souplesse",
      general: "Forme générale",
    };
    return map[g] || (p as any)?.objectif || "";
  }, [p, t]);

  // Conserver saved/later quand on change de mode
  const qsKeep = [
    savedIdSet.size ? `saved=${[...savedIdSet].join(",")}` : undefined,
    laterIdSet.size ? `later=${[...laterIdSet].join(",")}` : undefined,
  ]
    .filter(Boolean)
    .join("&");

  const hrefFull = `/dashboard/profile${qsKeep ? `?${qsKeep}` : ""}`;
  const hrefNone = `/dashboard/profile?equip=none${qsKeep ? `&${qsKeep}` : ""}`;

  const titleList =
    equipMode === "none"
      ? tf("settings.profile.sessions.titleNoEquip", "Mes séances (sans matériel)")
      : tf("settings.profile.sessions.title", "Mes séances");

  // Base de query pour les liens vers les détails de séance
  const baseLinkQuery = [
    equipMode === "none" ? "equip=none" : undefined,
    savedIdSet.size ? `saved=${[...savedIdSet].join(",")}` : undefined,
    laterIdSet.size ? `later=${[...laterIdSet].join(",")}` : undefined,
  ]
    .filter(Boolean)
    .join("&");

  const savedList = initialSessions
    .map((s, i) => ({ s, idx: i, key: sessionKey(s, i) }))
    .filter(({ key }) => savedIdSet.has(key));

  const laterList = initialSessions
    .map((s, i) => ({ s, idx: i, key: sessionKey(s, i) }))
    .filter(({ key }) => laterIdSet.has(key));

  // ✅ NEW: Sync "Séance faite" vers la home (cookie app_sessions)
  useEffect(() => {
    // On ne sync que si on a un programme (sinon rien à écrire)
    if (!hasGenerate) return;

    // On transforme la liste "faite" en une liste stable d'IDs
    // IMPORTANT: le Dashboard utilise app_sessions, donc on écrit dedans ici.
    const done = savedList.map(({ s, key, idx }) => ({
      sessionId: String(s.id || key), // id réel si dispo, sinon clé "sX"
      title: s.title || `Séance ${idx + 1}`,
      type: (s as any)?.type ? String((s as any).type) : undefined,
    }));

    syncDoneSessionsToCookie(done);
  }, [hasGenerate, savedList]);

  // Ce lien sert uniquement à forcer une nouvelle génération du programme
  const hrefGenerate = `/dashboard/profile?generate=1${
    equipMode === "none" ? "&equip=none" : ""
  }${qsKeep ? `&${qsKeep}` : ""}`;

  return (
    <div
      className="container"
      style={{
        paddingTop: 24,
        paddingBottom: 32,
        fontSize: "var(--settings-fs, 12px)",
      }}
    >
      {/* 👇 Overlay pub PLEIN ÉCRAN après clic sur "Générer" */}
      {showAdOverlay && (
        <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
          <div className="w-full h-full flex items-center justify-center">
            <AdBanner
              slot="REPLACE_WITH_YOUR_SLOT_ID"
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="h1" style={{ fontSize: 22 }}>
            {tf("settings.profile.title", "Mon profil")}
          </h1>
          {showDebug && (
            <div className="text-xs" style={{ marginTop: 4, color: "#6b7280" }}>
              <b>Debug:</b> email = <code>{emailForDisplay || "—"}</code>{" "}
              {debugInfo.sheetHit ? "· Sheet OK" : `· ${debugInfo.reason || "Sheet KO"}`}
              {forceBlank ? " · BLANK MODE" : ""}
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {!!displayedSuccess && (
          <div
            className="card"
            style={{
              border: "1px solid rgba(16,185,129,.35)",
              background: "rgba(16,185,129,.08)",
              fontWeight: 600,
            }}
          >
            {displayedSuccess === "programme"
              ? tf(
                  "settings.profile.messages.programmeUpdated",
                  "✓ Programme IA mis à jour à partir de vos dernières réponses au questionnaire."
                )
              : tf("settings.profile.messages.successGeneric", "✓ Opération réussie.")}
          </div>
        )}
        {!!displayedError && (
          <div
            className="card"
            style={{
              border: "1px solid rgba(239,68,68,.35)",
              background: "rgba(239,68,68,.08)",
              fontWeight: 600,
              whiteSpace: "pre-wrap",
            }}
          >
            ⚠️ {displayedError}
          </div>
        )}
      </div>

      {/* ===== Mes infos ===== */}
      <section className="section" style={{ marginTop: 12 }}>
        <div
          className="section-head"
          style={{
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h2>{tf("settings.profile.infoSection.title", "Mes infos")}</h2>
        </div>

        <div className="card">
          <div className="text-sm" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {(clientPrenom || showPlaceholders) && (
              <span>
                <b>{tf("settings.profile.info.firstName.label", "Prénom")} :</b>{" "}
                {clientPrenom ||
                  (showPlaceholders && (
                    <i className="text-gray-400">
                      {tf("settings.profile.info.firstName.missing", "Non renseigné")}
                    </i>
                  ))}
              </span>
            )}

            {(typeof clientAge === "number" || showPlaceholders) && (
              <span>
                <b>{tf("settings.profile.info.age.label", "Âge")} :</b>{" "}
                {typeof clientAge === "number" ? (
                  `${clientAge} ans`
                ) : (
                  showPlaceholders && (
                    <i className="text-gray-400">
                      {tf("settings.profile.info.age.missing", "Non renseigné")}
                    </i>
                  )
                )}
              </span>
            )}

            {(goalLabel || showPlaceholders) && (
              <span>
                <b>{tf("settings.profile.info.goal.label", "Objectif actuel")} :</b>{" "}
                {goalLabel ||
                  (showPlaceholders && (
                    <i className="text-gray-400">
                      {tf("settings.profile.info.goal.missing", "Non défini")}
                    </i>
                  ))}
              </span>
            )}
          </div>

          {(emailForDisplay || showPlaceholders) && (
            <div
              className="text-sm"
              style={{
                marginTop: 6,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={emailForDisplay || (showPlaceholders ? "Non renseigné" : "")}
            >
              <b>{tf("settings.profile.info.mail.label", "Mail")} :</b>{" "}
              {emailForDisplay ? (
                <a href={`mailto:${emailForDisplay}`} className="underline">
                  {emailForDisplay}
                </a>
              ) : (
                showPlaceholders && (
                  <span className="text-gray-400">
                    {tf("settings.profile.info.mail.missing", "Non renseigné")}
                  </span>
                )
              )}
            </div>
          )}

          <div className="text-sm" style={{ marginTop: 10 }}>
            <a href={questionnaireUrl} className="underline">
              {tf(
                "settings.profile.info.questionnaire.updateLink",
                "Mettre à jour mes réponses au questionnaire"
              )}
            </a>
          </div>
        </div>
      </section>

      {/* ===== Génération / Mes séances + bascule matériel/sans matériel ===== */}
      <section className="section" style={{ marginTop: 16 }}>
        <div
          className="section-head"
          style={{
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0 }}>{titleList}</h2>

          {hasGenerate && (
            <div className="inline-flex items-center" style={{ display: "inline-flex", gap: 8 }}>
              <a
                href={hrefFull}
                className={
                  equipMode === "full"
                    ? "inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white"
                    : "inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900"
                }
                title={tf(
                  "settings.profile.sessions.toggle.withEquipTitle",
                  "Voir la liste avec matériel"
                )}
              >
                {tf("settings.profile.sessions.toggle.withEquip", "Matériel")}
              </a>
              <a
                href={hrefNone}
                className={
                  equipMode === "none"
                    ? "inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white"
                    : "inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900"
                }
                title={tf(
                  "settings.profile.sessions.toggle.withoutEquipTitle",
                  "Voir la liste sans matériel"
                )}
              >
                {tf("settings.profile.sessions.toggle.withoutEquip", "Sans matériel")}
              </a>
            </div>
          )}
        </div>

        {/* 🟡 ÉTAT AVANT CLIC SUR GÉNÉRER */}
        {!hasGenerate && (
          <div
            className="card"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div className="text-sm" style={{ color: "#4b5563" }}>
              {tf(
                "settings.profile.sessions.generateCard.text",
                "Files te prépare ton programme. Clique sur « Générer » pour l’afficher."
              )}
            </div>
            <a
              href={hrefGenerate}
              className="inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
              title={tf("settings.profile.sessions.generateCard.buttonTitle", "Générer mon programme")}
            >
              {tf("settings.profile.sessions.generateCard.button", "→ Générer mon programme")}
            </a>
          </div>
        )}

        {hasGenerate && (
          <GenerateClient
            email={emailForDisplay}
            questionnaireBase={questionnaireBase}
            initialSessions={initialSessions}
            linkQuery={baseLinkQuery}
          />
        )}
      </section>

      {/* ===== Bloc bas de page : Séance faite ✅ / À faire plus tard ⏳ ===== */}
      <section className="section" style={{ marginTop: 20 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{tf("settings.profile.lists.title", "Mes listes")}</h2>
        </div>

        <div className="grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Séance faite ✅ */}
          <div className="card">
            <div className="text-sm" style={{ fontWeight: 600, marginBottom: 6 }}>
              {tf("settings.profile.lists.done.title", "Séance faite")} <span aria-hidden>✅</span>
            </div>

            {savedList.length > 0 && (
              <ul className="text-sm" style={{ listStyle: "disc", paddingLeft: 18, margin: 0 }}>
                {savedList.map(({ s, idx, key }) => {
                  const detailHref = `/dashboard/seance/${encodeURIComponent(s.id || key)}${
                    baseLinkQuery ? `?${baseLinkQuery}` : ""
                  }`;

                  const newSavedKeys = [...savedIdSet].filter((k) => k !== key);
                  const removeQuery = [
                    equipMode === "none" ? "equip=none" : undefined,
                    newSavedKeys.length ? `saved=${newSavedKeys.join(",")}` : undefined,
                    laterIdSet.size ? `later=${[...laterIdSet].join(",")}` : undefined,
                  ]
                    .filter(Boolean)
                    .join("&");
                  const removeHref = `/dashboard/profile${removeQuery ? `?${removeQuery}` : ""}`;

                  return (
                    <li
                      key={key}
                      style={{
                        marginBottom: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <a
                        href={detailHref}
                        style={{
                          fontWeight: 600,
                          textDecoration: "underline",
                          textUnderlineOffset: 2,
                        }}
                      >
                        {s.title || `Séance ${idx + 1}`}
                        {s.type && <span style={{ color: "#6b7280" }}> · {s.type}</span>}
                      </a>

                      <a
                        href={removeHref}
                        aria-label={tf("settings.profile.lists.removeLabel", "Supprimer cette séance")}
                        className="text-xs"
                        style={{
                          fontSize: 12,
                          padding: "2px 4px",
                          borderRadius: 999,
                          border: "1px solid #e5e7eb",
                          color: "#6b7280",
                          lineHeight: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        🗑️
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* À faire plus tard ⏳ */}
          <div className="card">
            <div className="text-sm" style={{ fontWeight: 600, marginBottom: 6 }}>
              {tf("settings.profile.lists.later.title", "À faire plus tard")}{" "}
              <span aria-hidden>⏳</span>
            </div>

            {laterList.length > 0 && (
              <ul className="text-sm" style={{ listStyle: "disc", paddingLeft: 18, margin: 0 }}>
                {laterList.map(({ s, idx, key }) => {
                  const detailHref = `/dashboard/seance/${encodeURIComponent(s.id || key)}${
                    baseLinkQuery ? `?${baseLinkQuery}` : ""
                  }`;

                  const newLaterKeys = [...laterIdSet].filter((k) => k !== key);
                  const removeQuery = [
                    equipMode === "none" ? "equip=none" : undefined,
                    savedIdSet.size ? `saved=${[...savedIdSet].join(",")}` : undefined,
                    newLaterKeys.length ? `later=${newLaterKeys.join(",")}` : undefined,
                  ]
                    .filter(Boolean)
                    .join("&");
                  const removeHref = `/dashboard/profile${removeQuery ? `?${removeQuery}` : ""}`;

                  return (
                    <li
                      key={key}
                      style={{
                        marginBottom: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <a
                        href={detailHref}
                        style={{
                          fontWeight: 600,
                          textDecoration: "underline",
                          textUnderlineOffset: 2,
                        }}
                      >
                        {s.title || `Séance ${idx + 1}`}
                        {s.type && <span style={{ color: "#6b7280" }}> · {s.type}</span>}
                      </a>

                      <a
                        href={removeHref}
                        aria-label={tf("settings.profile.lists.removeLabel", "Supprimer cette séance")}
                        className="text-xs"
                        style={{
                          fontSize: 12,
                          padding: "2px 4px",
                          borderRadius: 999,
                          border: "1px solid #e5e7eb",
                          color: "#6b7280",
                          lineHeight: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        🗑️
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
