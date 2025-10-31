"use client";

import { useState } from "react";
import type { AiSession as AiSessionT, Profile as ProfileT } from "../../../lib/coach/ai";
import { planProgrammeFromProfile } from "../../../lib/coach/beton";

type Props = {
  email?: string;
  questionnaireBase: string;
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

export default function GenerateClient({ email, questionnaireBase }: Props) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<AiSessionT[]>([]);
  const [error, setError] = useState<string>("");
  const [hasGenerated, setHasGenerated] = useState(false);

  async function onGenerate() {
    try {
      setLoading(true);
      setError("");
      setHasGenerated(true);

      const url = email ? `/api/answers?email=${encodeURIComponent(email)}` : `/api/answers`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      const answers: Record<string, any> | null = data?.answers || null;
      const baseProfile: Partial<ProfileT> = data?.profile || {};

      const { sessions } = planProgrammeFromProfile(baseProfile as any, { maxSessions: 3 });
      setSessions(sessions);
    } catch (e: any) {
      console.error("[GenerateClient] onGenerate error", e);
      setError("Impossible de générer les séances. Réessaie plus tard.");
    } finally {
      setLoading(false);
    }
  }

  const showList = hasGenerated && sessions.length > 0;

  return (
    <section className="section" style={{ marginTop: 12 }}>
      <div className="section-head" style={{ marginBottom: 8 }}>
        <h2 style={{ marginBottom: 6 }}>Mes séances</h2>
      </div>

      {error && (
        <div
          className="card text-sm"
          style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600 }}
        >
          ⚠️ {error}
        </div>
      )}

      {!showList && (
        <div className="card text-sm" style={{ color: "#6b7280" }}>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🤖</span>
            <span>
              Cliquez sur <strong>« Générer »</strong> pour voir vos séances.
            </span>
          </div>
        </div>
      )}

      {showList && (
        <ul className="space-y-2 list-none pl-0">
          {sessions.map((s) => {
            const qp = new URLSearchParams({
              title: s.title,
              date: s.date,
              type: s.type,
              plannedMin: s.plannedMin ? String(s.plannedMin) : "",
            });
            const href = `/dashboard/seance/${encodeURIComponent(s.id)}?${qp.toString()}`;
            const displayTitle = (s.title || "").replace(/^(S[eé]ance)s?\s+de\b/i, "Séance");

            return (
              <li key={s.id} className="card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={href}
                      className="font-medium underline-offset-2 hover:underline truncate"
                      style={{ fontSize: 16 }}
                      title={displayTitle}
                    >
                      {displayTitle}
                    </a>
                    <div className="text-xs mt-0.5 text-gray-500">
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
