// apps/web/app/dashboard/profile/GenerateClient.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AiSession } from "../../../lib/coach/ai";

type Props = {
  email: string;
  questionnaireBase: string;
  initialSessions?: AiSession[]; // ✅ ajouté pour corriger l’erreur TS
};

export default function GenerateClient({ email, questionnaireBase, initialSessions = [] }: Props) {
  const router = useRouter();

  const [sessions, setSessions] = useState<AiSession[]>(initialSessions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/programme?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok || !data.sessions) {
        throw new Error(data.error || "Erreur de génération du programme.");
      }
      setSessions(data.sessions);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  return (
    <section className="section" style={{ marginTop: 24 }}>
      <div className="section-head" style={{ marginBottom: 8 }}>
        <h2>Mes séances</h2>
      </div>

      {/* Bouton de génération */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="btn"
          style={{
            background: "#111827",
            color: "white",
            padding: "8px 16px",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {loading ? "Génération en cours..." : "Générer le programme"}
        </button>
      </div>

      {/* Erreur */}
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

      {/* Liste des séances */}
      {!loading && sessions && sessions.length > 0 && (
        <div className="space-y-2">
          {sessions.map((s, i) => (
            <div key={s.id || i} className="card" style={{ padding: 12 }}>
              <div className="font-semibold">{s.title}</div>
              <div className="text-xs text-gray-500">
                {s.date ? `📅 ${s.date}` : ""} · {s.type}
                {s.plannedMin ? ` · ${s.plannedMin} min` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Aucun résultat */}
      {!loading && (!sessions || sessions.length === 0) && (
        <div className="text-sm text-gray-500">
          Aucune séance trouvée pour le moment.
        </div>
      )}
    </section>
  );
}
