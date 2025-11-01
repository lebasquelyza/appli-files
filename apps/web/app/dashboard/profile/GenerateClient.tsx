"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AiSession } from "../../../lib/coach/ai"; // app/dashboard/profile -> app -> web -> lib

type Props = {
  email: string;
  questionnaireBase: string;
  initialSessions?: AiSession[];
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

export default function GenerateClient({ email, questionnaireBase, initialSessions = [] }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState<AiSession[]>(initialSessions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState<string>("");

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
            const href = `/dashboard/seance/${encodeURIComponent(s.id)}?title=${encodeURIComponent(cleanTitle)}&type=${encodeURIComponent(s.type)}`;
            return (
              <li
                key={s.id || `s-${i}`}
                onClick={() => router.push(href)}
                className="card hover:bg-gray-50 cursor-pointer transition"
                style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">
                      {cleanTitle || "Séance"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {s.type}{s.plannedMin ? ` · ${s.plannedMin} min` : ""}
                    </div>
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

