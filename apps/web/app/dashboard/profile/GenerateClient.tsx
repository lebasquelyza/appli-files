// apps/web/app/dashboard/profile/GenerateClient.tsx
"use client";

import React, { useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { AiSession } from "../../../lib/coach/ai";
import { useLanguage } from "@/components/LanguageProvider";

type Props = {
  email: string;
  questionnaireBase: string;
  initialSessions?: AiSession[];
  linkQuery?: string;
};

/* ----- Helpers URL ----- */
function parseSet(param: string | null): Set<string> {
  return new Set(
    (param || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}
function toParam(set: Set<string>) {
  return [...set].join(",");
}
function sessionKey(_s: AiSession, idx: number) {
  return `s${idx}`;
}

export default function GenerateClient({
  email,
  questionnaireBase,
  initialSessions = [],
  linkQuery,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, lang } = useLanguage();

  // Fallback i18n helper
  const tf = (path: string, fallback?: string) => {
    const v = t(path);
    if (v && v !== path) return v;
    return fallback ?? path;
  };

  // ✅ On PART des séances calculées côté serveur (persistées en BDD)
  const sessions = initialSessions || [];

  const savedSet = useMemo(
    () => parseSet(searchParams.get("saved")),
    [searchParams]
  );
  const laterSet = useMemo(
    () => parseSet(searchParams.get("later")),
    [searchParams]
  );

  /* ======== GÉNÉRATION (via serveur) ======== */
  // On ne fait PLUS de fetch /api/programme ici.
  // On déclenche juste une navigation avec ?generate=1
  // → c'est page.tsx qui décide de régénérer ou non (selon le questionnaire).
  const handleGenerate = () => {
    const sp = new URLSearchParams(searchParams?.toString() || "");
    sp.set("generate", "1"); // indique au serveur "on veut régénérer"
    router.push(`${pathname}?${sp.toString()}`);
  };

  /* ----- Mise à jour URL saved/later ----- */
  const navigateWith = (nextSaved: Set<string>, nextLater: Set<string>) => {
    const sp = new URLSearchParams(searchParams?.toString() || "");
    const savedStr = toParam(nextSaved);
    const laterStr = toParam(nextLater);

    if (savedStr) sp.set("saved", savedStr);
    else sp.delete("saved");
    if (laterStr) sp.set("later", laterStr);
    else sp.delete("later");

    router.push(`${pathname}?${sp.toString()}`);
  };

  const markDone = (key: string) => {
    const nextSaved = new Set(savedSet);
    const nextLater = new Set(laterSet);
    nextSaved.add(key);
    nextLater.delete(key);
    navigateWith(nextSaved, nextLater);
  };

  const markLater = (key: string) => {
    const nextSaved = new Set(savedSet);
    const nextLater = new Set(laterSet);
    nextLater.add(key);
    nextSaved.delete(key);
    navigateWith(nextSaved, nextLater);
  };

  /* ======== UI ======== */

  return (
    <section className="section" style={{ marginTop: 24 }}>
      {/* HEADER */}
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
        <h2 className="font-semibold text-lg">
          {tf(
            "settings.profile.generate.title",
            lang === "fr" ? "Mes séances" : "My sessions"
          )}
        </h2>

        {/* Bouton Générer / Régénérer (via serveur) */}
        <button
          onClick={handleGenerate}
          className="btn"
          style={{
            background: "#111827",
            color: "white",
            padding: "4px 10px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {tf(
            "settings.profile.generate.button.generate",
            lang === "fr" ? "⚙️ Régénérer" : "⚙️ Regenerate"
          )}
        </button>
      </div>

      {/* LISTE DES SÉANCES (toujours celles venant du serveur) */}
      {sessions && sessions.length > 0 && (
        <ul className="space-y-2 list-none pl-0">
          {sessions.map((s, i) => {
            const key = sessionKey(s, i);
            const baseHref = `/dashboard/seance/${encodeURIComponent(
              s.id || key
            )}`;
            const href = linkQuery ? `${baseHref}?${linkQuery}` : baseHref;

            return (
              <li
                key={s.id || `s-${i}`}
                className="card hover:bg-gray-50 transition"
                style={{
                  padding: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Zone cliquable */}
                  <div
                    onClick={() => router.push(href)}
                    className="cursor-pointer"
                    style={{ minWidth: 0 }}
                  >
                    {/* Titre IA EXACT (FR ou EN) */}
                    <div className="font-medium text-sm truncate">
                      {s.title || (lang === "fr" ? "Séance" : "Session")}
                    </div>

                    <div className="text-xs text-gray-500">
                      {s.type}
                      {s.plannedMin ? ` · ${s.plannedMin} min` : ""}
                    </div>
                  </div>

                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 hover:border-neutral-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        markDone(key);
                      }}
                    >
                      {lang === "fr" ? "Enregistrer" : "Save"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* (normalement, GenerateClient est rendu seulement si hasGenerate = true,
          donc sessions.length > 0 ; sinon, la carte "Générer mon programme"
          est gérée côté ProfileClient.) */}
    </section>
  );
}
