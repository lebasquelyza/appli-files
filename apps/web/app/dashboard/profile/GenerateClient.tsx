"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { AiSession } from "../../../lib/coach/ai"; // app/dashboard/profile -> app -> web -> lib

type Props = {
  email: string;
  questionnaireBase: string;
  initialSessions?: AiSession[];
  /** Optionnel : ex. "equip=none" pour conserver le mode dans les liens des séances */
  linkQuery?: string;
};

type Focus = "upper" | "lower" | "mix" | "full";

/* ===== helpers focus ===== */
function cycleForGoal(goal?: string): Focus[] {
  const g = String(goal || "").toLowerCase();
  if (g === "hypertrophy" || g === "strength") return ["upper", "lower", "upper", "lower", "mix", "upper"];
  if (g === "fatloss" || g === "endurance") return ["full", "mix", "full", "mix", "full", "mix"];
  if (g === "mobility") return ["mix", "mix", "mix", "mix", "mix", "mix"];
  return ["full", "mix", "upper", "lower", "mix", "full"];
}
function focusLabel(f: Focus) {
  return f === "upper" ? "Haut du corps" :
         f === "lower" ? "Bas du corps" :
         f === "full"  ? "Full body" :
                         "Mix";
}
function extractNameFromTitle(raw?: string) {
  const s = String(raw || "");
  return (s.match(/S[ée]ance\s+pour\s+([^—–-]+)/i)?.[1] || "").trim();
}
/* Supprime les variantes “— A”, “- B”, “· C”, “(D)” éventuelles */
function stripVariantLetter(s?: string) {
  return String(s || "")
    .replace(/\s*[—–-]\s*[A-Z]\b/gi, "")  // "— A" / "- B"
    .replace(/\s*·\s*[A-Z]\b/gi, "")      // "· C"
    .replace(/\s*\(([A-Z])\)\s*$/gi, "")  // "(D)"
    .trim();
}
function makeTitle(raw: string | undefined, focus: Focus) {
  const base = stripVariantLetter(raw);
  const name = extractNameFromTitle(base);
  const label = focusLabel(focus);
  return name ? `Séance pour ${name} — ${label}` : label;
}

/* ===== helpers URL (saved/later) ===== */
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
  // Clé simple et stable basée sur l'index, en cohérence avec la page / bloc "Mes listes"
  return `s${idx}`;
}

export default function GenerateClient({ email, questionnaireBase, initialSessions = [], linkQuery }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sessions, setSessions] = useState<AiSession[]>(initialSessions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState<string>("");

  // Menu inline "Enregistrer" ouvert pour quel index ?
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // Sets actuels d'après l'URL (pour afficher les pills + cohérence avec "Mes listes")
  const savedSet = useMemo(() => parseSet(searchParams.get("saved")), [searchParams]);
  const laterSet = useMemo(() => parseSet(searchParams.get("later")), [searchParams]);

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  useEffect(() => {
    (async () => {
      try {
        const url = email ? `/api/answers?email=${encodeURIComponent(email)}` : `/api/answers`;
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        const raw = String(
          data?.profile?.goal ||
          data?.answers?.goal ||
          data?.answers?.objectif ||
          ""
        ).toLowerCase();
        setGoal(raw);
      } catch {}
    })();
  }, [email]);

  async function handleGenerate() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/programme?email=${encodeURIComponent(email)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.sessions) {
        throw new Error(data.error || "Erreur de génération du programme.");
      }
      // applique un focus par position selon l’objectif
      const cycle = cycleForGoal(goal);
      const focused: AiSession[] = (data.sessions as AiSession[]).map((s: AiSession, i: number) => {
        const f = cycle[i % cycle.length];
        return {
          ...s,
          title: makeTitle(s.title, f), // inscrit focus + sans lettre A/B/C
        };
      });
      setSessions(focused);
    } catch (e: any) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  /* ---- Mise à jour de l'URL pour saved/later (sans toucher à la logique serveur) ---- */
  const navigateWith = (nextSaved: Set<string>, nextLater: Set<string>) => {
    const sp = new URLSearchParams(searchParams?.toString() || "");
    const savedStr = toParam(nextSaved);
    const laterStr = toParam(nextLater);
    if (savedStr) sp.set("saved", savedStr); else sp.delete("saved");
    if (laterStr) sp.set("later", laterStr); else sp.delete("later");
    router.push(`${pathname}?${sp.toString()}`);
  };

  const markDone = (key: string) => {
    const nextSaved = new Set(savedSet);
    const nextLater = new Set(laterSet);
    nextSaved.add(key);
    nextLater.delete(key);
    navigateWith(nextSaved, nextLater);
    setOpenIdx(null);
  };

  const markLater = (key: string) => {
    const nextSaved = new Set(savedSet);
    const nextLater = new Set(laterSet);
    nextLater.add(key);
    nextSaved.delete(key);
    navigateWith(nextSaved, nextLater);
    setOpenIdx(null);
  };

  return (
    <section className="section" style={{ marginTop: 24 }}>
      <div
        className="section-head"
        style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <h2 className="font-semibold text-lg">Mes séances</h2>
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
          title="Générer/mettre à jour le programme"
        >
          {loading ? "⏳..." : "⚙️ Générer"}
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            padding: "8px 10px",
            borderRadius: 6,
            fontSize: 13,
            color: "#b91c1c",
            marginBottom: 8,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {!loading && sessions && sessions.length > 0 && (
        <ul className="space-y-2 list-none pl-0">
          {sessions.map((s, i) => {
            const cleanTitle = stripVariantLetter(s.title);
            const baseHref = `/dashboard/seance/${encodeURIComponent(s.id)}?title=${encodeURIComponent(cleanTitle)}&type=${encodeURIComponent(s.type)}`;
            const href = linkQuery ? `${baseHref}&${linkQuery}` : baseHref;

            const key = sessionKey(s, i);
            const isSaved = savedSet.has(key);
            const isLater = laterSet.has(key);

            return (
              <li
                key={s.id || `s-${i}`}
                className="card hover:bg-gray-50 transition"
                style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Zone cliquable pour ouvrir la séance */}
                  <div
                    onClick={() => router.push(href)}
                    className="cursor-pointer"
                    style={{ minWidth: 0 }}
                  >
                    <div className="font-medium text-sm truncate">
                      {cleanTitle || "Séance"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {s.type}{s.plannedMin ? ` · ${s.plannedMin} min` : ""}
                    </div>

                    {/* Badges d'état */}
                    <div className="flex items-center gap-2 mt-1">
                      {isSaved && (
                        <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border border-emerald-600" aria-label="Enregistrée">
                          ✅ Enregistrée
                        </span>
                      )}
                      {isLater && (
                        <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border border-amber-600" aria-label="À faire plus tard">
                          ⏳ Plus tard
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bouton Enregistrer + mini-menu */}
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 hover:border-neutral-400"
                      onClick={(e) => { e.stopPropagation(); setOpenIdx(openIdx === i ? null : i); }}
                      aria-haspopup="menu"
                      aria-expanded={openIdx === i}
                      title="Enregistrer cette séance"
                    >
                      Enregistrer
                    </button>

                    {openIdx === i && (
                      <div
                        role="menu"
                        className="card"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "calc(100% + 6px)",
                          zIndex: 20,
                          padding: 8,
                          minWidth: 220,
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          background: "white",
                          boxShadow: "0 8px 24px rgba(0,0,0,.08)",
                        }}
                      >
                        <div className="text-xs" style={{ color: "#6b7280", marginBottom: 6 }}>
                          Choisir une action
                        </div>
                        <div className="space-y-2">
                          <button
                            role="menuitem"
                            className="w-full text-left inline-flex items-center justify-between rounded-md border border-emerald-600/50 bg-emerald-50 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-100"
                            onClick={() => markDone(key)}
                            title="Ajouter à « Séances enregistrées »"
                          >
                            Fait <span aria-hidden>✅</span>
                          </button>
                          <button
                            role="menuitem"
                            className="w-full text-left inline-flex items-center justify-between rounded-md border border-amber-600/50 bg-amber-50 px-3 py-1.5 text-sm font-semibold hover:bg-amber-100"
                            onClick={() => markLater(key)}
                            title="Ajouter à « À faire plus tard »"
                          >
                            À faire plus tard <span aria-hidden>⏳</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && (!sessions || sessions.length === 0) && (
        <div className="text-sm text-gray-500">Aucune séance disponible pour le moment.</div>
      )}
    </section>
  );
}

