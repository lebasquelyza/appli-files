// apps/web/app/dashboard/profile/GenerateClient.tsx
"use client";

import { useState } from "react";
import type { AiSession as AiSessionT } from "../../../lib/coach/ai";

type Props = {
  email?: string;
  questionnaireBase: string;
  initialSessions?: AiSessionT[];
};

type WorkoutType = "muscu" | "cardio" | "hiit" | "mobilité";

function typeBadgeClass(t: WorkoutType) {
  switch (t) {
    case "muscu": return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "cardio": return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    case "hiit": return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "mobilité": return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
  }
}

export default function GenerateClient({ email, questionnaireBase, initialSessions = [] }: Props) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<AiSessionT[]>(initialSessions);
  const [error, setError] = useState<string>("");

  async function onGenerate() {
    try {
      setLoading(true);
      setError("");

      const url = email ? `/api/programme?email=${encodeURIComponent(email)}` : `/api/programme`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Programme indisponible");
      }

      const serverSessions: AiSessionT[] = Array.isArray(data?.sessions) ? data.sessions : [];
      setSessions(serverSessions);
    } catch (e: any) {
      setError(e?.message || "Impossible de récupérer votre programme pour le moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section" style={{ marginTop: 12 }}>
      <div
        className="section-head"
        style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <div>
          <h2 style={{ marginBottom: 6 }}>Mon programme</h2>
          <p className="text-sm" style={{ color: "#6b7280" }}>
            Généré automatiquement selon vos dernières réponses au questionnaire.
          </p>
        </div>

        <button
          onClick={onGenerate}
          disabled={loading}
          className="btn"
          style={{ background: "#111827", color: "#ffffff", border: "1px solid #d1d5db", fontWeight: 600, padding: "6px 10px", lineHeight: 1.2, borderRadius: 8 }}
          title="Génère/Met à jour ton programme personnalisé"
        >
          {loading ? "⏳ Génération..." : "⚙️ Générer"}
        </button>
      </div>

      {error && (
        <div
          className="card text-sm"
          style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600, whiteSpace: "pre-wrap" }}
        >
          ⚠️ {error}
        </div>
      )}

      {(!sessions || sessions.length === 0) ? (
        <div className="card text-sm" style={{ color: "#6b7280" }}>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🤖</span>
            <span>
              Pas encore de séances.{" "}
              <a className="link underline" href={questionnaireBase}>
                Remplissez le questionnaire
              </a>{" "}
              puis cliquez sur « Générer ».
            </span>
          </div>
        </div>
      ) : (
        <ul className="space-y-2 list-none pl-0">
          {sessions.map((s) => {
            const qp = new URLSearchParams({
              title: s.title,
              date: s.date,
              type: s.type,
              plannedMin: s.plannedMin ? String(s.plannedMin) : "",
            });
            const href = `/dashboard/seance/${encodeURIComponent(s.id)}?${qp.toString()}`;

            return (
              <li key={s.id} className="card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={href}
                      className="font-medium underline-offset-2 hover:underline truncate"
                      style={{ fontSize: 16, display: "inline-block", maxWidth: "100%" }}
                      title={s.title}
                    >
                      {s.title}
                    </a>
                    <div className="text-xs mt-0.5 text-gray-500">
                      <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-1.5 py-0.5 mr-2">
                        IA
                      </span>
                      {s.plannedMin ? `${s.plannedMin} min` : "—"}
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(s.type as WorkoutType)}`}>
                    {s.type}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
