"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AiSession } from "../../../lib/coach/ai";

type Props = {
  email: string;
  questionnaireBase: string;
  initialSessions?: AiSession[];
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
      {/* ===== En-tête ===== */}
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
        <h2 className="font-semibold text-lg">Mes séances</h2>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="btn"
          style={{
            background: "#111827",
            color: "white",
            padding: "4px 10px", // ✅ bouton plus petit
            borderRadius: 6,
            fontSize: 12, // ✅ texte réduit
            fontWeight: 600,
            opacity: loading ? 0.7 : 1,
            transition: "opacity 0.2s",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "⏳..." : "⚙️ Générer"}
        </button>
      </div>

      {/* ===== Erreur ===== */}
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

      {/* ===== Liste des séances ===== */}
      {!loading && sessions && sessions.length > 0 && (
        <ul className="space-y-2 list-none pl-0">
          {sessions.map((s, i) => {
            const sessionId = s.id || `custom-${i}`; // ✅ fallback id si vide
            const href = `/dashboard/seance/${encodeURIComponent(sessionId)}`;
            return (
              <li
                key={sessionId}
                onClick={() => router.push(href)}
                className="card hover:bg-gray-50 cursor-pointer transition"
                style={{
                  padding: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{s.title || `Séance ${i + 1}`}</div>
                    <div className="text-xs text-gray-500">
                      {s.type}
                      {s.plannedMin ? ` · ${s.plannedMin} min` : ""}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ===== Aucun résultat ===== */}
      {!loading && (!sessions || sessions.length === 0) && (
        <div className="text-sm text-gray-500">Aucune séance disponible pour le moment.</div>
      )}
    </section>
  );
}

