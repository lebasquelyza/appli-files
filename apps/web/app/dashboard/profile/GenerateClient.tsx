"use client";

import React, { useMemo, useState } from "react";
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

  // 🔥 ON NE PART JAMAIS DES initialSessions
  const [sessions, setSessions] = useState<AiSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedSet = useMemo(
    () => parseSet(searchParams.get("saved")),
    [searchParams]
  );
  const laterSet = useMemo(
    () => parseSet(searchParams.get("later")),
    [searchParams]
  );

  /* ======== GÉNÉRATION ======== */
  async function handleGenerate() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/programme?email=${encodeURIComponent(email)}`,
        { cache: "no-store" }
      );
      const data = await res.json();

      if (!res.ok || !data.sessions) {
        throw new Error(
          data.error ||
            tf(
              "settings.profile.generate.error.generic",
              lang === "fr"
                ? "Erreur de génération du programme."
                : "Error while generating your program."
            )
        );
      }

      // 🔥 On prend les titres EXACTS de l’IA (FR / EN)
      setSessions(data.sessions as AiSession[]);
    } catch (e: any) {
      setError(
        e?.message ||
          tf(
            "settings.profile.generate.error.unknown",
            lang === "fr" ? "Erreur inconnue." : "Unknown error."
          )
      );
    } finally {
      setLoading(false);
    }
  }

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

        {/* Bouton Générer */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="btn"
          style={{
            background: "#111827",
            color: "white",
            padding: "4px 10px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            opacity: loading ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {loading
            ? tf(
                "settings.profile.generate.button.generating",
                lang === "fr" ? "⏳ Génération…" : "⏳ Generating…"
              )
            : tf(
                "settings.profile.generate.button.generate",
                lang === "fr" ? "⚙️ Générer" : "⚙️ Generate"
              )}
        </button>
      </div>

      {/* ERREURS */}
      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            padding: "8px 10px",
            borderRadius: 6,
            color: "#b91c1c",
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* MESSAGE AVANT GÉNÉRATION */}
      {!loading && sessions.length === 0 && (
        <div
          className="card"
          style={{
            padding: "14px 16px",
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 10,
          }}
        >
          <div className="text-sm" style={{ color: "#4b5563" }}>
            {lang === "fr"
              ? "🔧 Files doit créer ton programme personnalisé. Clique sur « Générer » pour afficher tes séances."
              : "🔧 Files needs to create your personalized program. Click “Generate” to display your sessions."}
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white"
          >
            {lang === "fr" ? "Générer" : "Generate"}
          </button>
        </div>
      )}

      {/* LISTE DES SÉANCES APRÈS GÉNÉRATION */}
      {sessions && sessions.length > 0 && (
        <ul className="space-y-2 list-none pl-0">
          {sessions.map((s, i) => {
            const key = sessionKey(s, i);
            const baseHref = `/dashboard/seance/${encodeURIComponent(
              s.id
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
                  opacity: loading ? 0.8 : 1,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Zone cliquable */}
                  <div
                    onClick={() => router.push(href)}
                    className={loading ? "cursor-not-allowed" : "cursor-pointer"}
                    style={{ minWidth: 0 }}
                  >
                    {/* Titre IA EXACT (FR ou EN) */}
                    <div className="font-medium text-sm truncate">
                      {s.title}
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
                      disabled={loading}
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
    </section>
  );
}
