"use client";

import { useMemo } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import GenerateClient from "./GenerateClient";
import type { Profile as ProfileT, AiSession as AiSessionT, WorkoutType, NormalizedExercise } from "../../../lib/coach/ai";

// Helpers UI (copiés de ton fichier)
function parseIdListFromArray(list: string[] | undefined) {
  return new Set(list ?? []);
}
function sessionKey(_s: AiSessionT, idx: number) {
  return `s${idx}`;
}

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
};

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
  } = props;

  const { t } = useLanguage();

  const savedIdSet = useMemo(() => parseIdListFromArray(savedIds), [savedIds]);
  const laterIdSet = useMemo(() => parseIdListFromArray(laterIds), [laterIds]);

  const showPlaceholders = !forceBlank;
  const p = (profile ?? {}) as Partial<ProfileT>;

  const clientPrenom =
    typeof p?.prenom === "string" && p.prenom && !/\d/.test(p.prenom)
      ? p.prenom
      : "";
  const clientAge =
    typeof p?.age === "number" && p.age > 0 ? p.age : undefined;

  // ==== goalLabel avec la même logique mais i18n client ====
  const goalLabel = useMemo(() => {
    const g = String((p as any)?.objectif || (p as any)?.goal || "").toLowerCase();
    if (!g) return "";
    const key = `profile.goal.labels.${g}`;
    const translated = t(key);
    // Si t(key) renvoie la clé brute, on applique le fallback local
    if (translated && translated !== key) return translated;

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

  const savedList = initialSessions
    .map((s, i) => ({ s, idx: i, key: sessionKey(s, i) }))
    .filter(({ key }) => savedIdSet.has(key));

  const laterList = initialSessions
    .map((s, i) => ({ s, idx: i, key: sessionKey(s, i) }))
    .filter(({ key }) => laterIdSet.has(key));

  const qsKeep = [
    hasGenerate ? "generate=1" : undefined,
    savedIdSet.size ? `saved=${[...savedIdSet].join(",")}` : undefined,
    laterIdSet.size ? `later=${[...laterIdSet].join(",")}` : undefined,
  ]
    .filter(Boolean)
    .join("&");

  const hrefFull = `/dashboard/profile${qsKeep ? `?${qsKeep}` : ""}`;
  const hrefNone = `/dashboard/profile?equip=none${qsKeep ? `&${qsKeep}` : ""}`;

  const titleList =
    equipMode === "none"
      ? t("profile.sessions.titleNoEquip") || "Mes séances (sans matériel)"
      : t("profile.sessions.title") || "Mes séances";

  const hrefGenerate = `/dashboard/profile?generate=1${
    equipMode === "none" ? "&equip=none" : ""
  }${qsKeep ? `&${qsKeep}` : ""}`;

  const baseLinkQuery = [
    equipMode === "none" ? "equip=none" : undefined,
    "generate=1",
    savedIdSet.size ? `saved=${[...savedIdSet].join(",")}` : undefined,
    laterIdSet.size ? `later=${[...laterIdSet].join(",")}` : undefined,
  ]
    .filter(Boolean)
    .join("&");

  return (
    <div
      className="container"
      style={{
        paddingTop: 24,
        paddingBottom: 32,
        fontSize: "var(--settings-fs, 12px)",
      }}
    >
      <div className="page-header">
        <div>
          <h1 className="h1" style={{ fontSize: 22 }}>
            {t("profile.title")}
          </h1>
          {showDebug && (
            <div
              className="text-xs"
              style={{ marginTop: 4, color: "#6b7280" }}
            >
              <b>Debug:</b> email = <code>{emailForDisplay || "—"}</code>{" "}
              {debugInfo.sheetHit
                ? "· Sheet OK"
                : `· ${debugInfo.reason || "Sheet KO"}`}
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
              ? t("profile.messages.programmeUpdated")
              : t("profile.messages.successGeneric")}
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

      {/* Mes infos */}
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
          <h2>{t("profile.infoSection.title")}</h2>
        </div>

        <div className="card">
          <div
            className="text-sm"
            style={{ display: "flex", gap: 16, flexWrap: "wrap" }}
          >
            {(clientPrenom || showPlaceholders) && (
              <span>
                <b>{t("profile.info.firstName.label")} :</b>{" "}
                {clientPrenom || (
                  showPlaceholders && (
                    <i className="text-gray-400">
                      {t("profile.info.firstName.missing")}
                    </i>
                  )
                )}
              </span>
            )}
            {(typeof clientAge === "number" || showPlaceholders) && (
              <span>
                <b>{t("profile.info.age.label")} :</b>{" "}
                {typeof clientAge === "number" ? (
                  `${clientAge} ans`
                ) : (
                  showPlaceholders && (
                    <i className="text-gray-400">
                      {t("profile.info.age.missing")}
                    </i>
                  )
                )}
              </span>
            )}
            {(goalLabel || showPlaceholders) && (
              <span>
                <b>{t("profile.info.goal.label")} :</b>{" "}
                {goalLabel || (
                  showPlaceholders && (
                    <i className="text-gray-400">
                      {t("profile.info.goal.missing")}
                    </i>
                  )
                )}
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
              <b>{t("profile.info.mail.label")} :</b>{" "}
              {emailForDisplay ? (
                <a href={`mailto:${emailForDisplay}`} className="underline">
                  {emailForDisplay}
                </a>
              ) : (
                showPlaceholders && (
                  <span className="text-gray-400">
                    {t("profile.info.mail.missing")}
                  </span>
                )
              )}
            </div>
          )}

          <div className="text-sm" style={{ marginTop: 10 }}>
            <a href={questionnaireUrl} className="underline">
              {t("profile.info.questionnaire.updateLink")}
            </a>
          </div>
        </div>
      </section>

      {/* Génération / Mes séances */}
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
            <div
              className="inline-flex items-center"
              style={{ display: "inline-flex", gap: 8 }}
            >
              <a
                href={hrefFull}
                className={
                  equipMode === "full"
                    ? "inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white"
                    : "inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900"
                }
                title={t("profile.sessions.toggle.withEquipTitle")}
              >
                {t("profile.sessions.toggle.withEquip")}
              </a>
              <a
                href={hrefNone}
                className{
                  equipMode === "none"
                    ? "inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white"
                    : "inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900"
                }
                title={t("profile.sessions.toggle.withoutEquipTitle")}
              >
                {t("profile.sessions.toggle.withoutEquip")}
              </a>
            </div>
          )}
        </div>

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
              {t("profile.sessions.generateCard.text")}
            </div>
            <a
              href={hrefGenerate}
              className="inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
              title={t("profile.sessions.generateCard.buttonTitle")}
            >
              {t("profile.sessions.generateCard.button")}
            </a>
          </div>
        )}

        {hasGenerate && (
          <GenerateClient
            email={emailForDisplay}
            questionnaireBase={"" /* plus utilisé ici */}
            initialSessions={initialSessions}
            linkQuery={baseLinkQuery}
          />
        )}
      </section>

      {/* Mes listes */}
      <section className="section" style={{ marginTop: 20 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{t("profile.lists.title")}</h2>
        </div>

        <div
          className="grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          {/* Séance faite */}
          <div className="card">
            <div
              className="text-sm"
              style={{ fontWeight: 600, marginBottom: 6 }}
            >
              {t("profile.lists.done.title")} <span aria-hidden>✅</span>
            </div>
            {savedList.length > 0 && (
              <ul
                className="text-sm"
                style={{ listStyle: "disc", paddingLeft: 18, margin: 0 }}
              >
                {savedList.map(({ s, idx, key }) => {
                  const detailHref = `/dashboard/seance/${encodeURIComponent(
                    s.id || key,
                  )}${baseLinkQuery ? `?${baseLinkQuery}` : ""}`;

                  const newSavedKeys = [...savedIdSet].filter((k) => k !== key);
                  const removeQuery = [
                    "generate=1",
                    equipMode === "none" ? "equip=none" : undefined,
                    newSavedKeys.length
                      ? `saved=${newSavedKeys.join(",")}`
                      : undefined,
                    laterIdSet.size
                      ? `later=${[...laterIdSet].join(",")}`
                      : undefined,
                  ]
                    .filter(Boolean)
                    .join("&");
                  const removeHref = `/dashboard/profile${
                    removeQuery ? `?${removeQuery}` : ""
                  }`;

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
                        {s.type && (
                          <span style={{ color: "#6b7280" }}> · {s.type}</span>
                        )}
                      </a>
                      <a
                        href={removeHref}
                        aria-label={t("profile.lists.removeLabel")}
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

          {/* À faire plus tard */}
          <div className="card">
            <div
              className="text-sm"
              style={{ fontWeight: 600, marginBottom: 6 }}
            >
              {t("profile.lists.later.title")} <span aria-hidden>⏳</span>
            </div>
            {laterList.length > 0 && (
              <ul
                className="text-sm"
                style={{ listStyle: "disc", paddingLeft: 18, margin: 0 }}
              >
                {laterList.map(({ s, idx, key }) => {
                  const detailHref = `/dashboard/seance/${encodeURIComponent(
                    s.id || key,
                  )}${baseLinkQuery ? `?${baseLinkQuery}` : ""}`;

                  const newLaterKeys = [...laterIdSet].filter((k) => k !== key);
                  const removeQuery = [
                    "generate=1",
                    equipMode === "none" ? "equip=none" : undefined,
                    savedIdSet.size
                      ? `saved=${[...savedIdSet].join(",")}`
                      : undefined,
                    newLaterKeys.length
                      ? `later=${newLaterKeys.join(",")}`
                      : undefined,
                  ]
                    .filter(Boolean)
                    .join("&");
                  const removeHref = `/dashboard/profile${
                    removeQuery ? `?${removeQuery}` : ""
                  }`;

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
                        {s.type && (
                          <span style={{ color: "#6b7280" }}> · {s.type}</span>
                        )}
                      </a>
                      <a
                        href={removeHref}
                        aria-label={t("profile.lists.removeLabel")}
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
