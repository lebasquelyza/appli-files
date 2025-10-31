// apps/web/app/dashboard/profile/GenerateClient.tsx
"use client";

import React, { useState, useEffect } from "react";
import type { AiSession } from "../../../lib/coach/ai";

/* =========================================================
 * 🔹 Composant GenerateClient
 * - Affiche le bouton de génération de programme IA
 * - Reçoit le mail client + URL du questionnaire
 * - (optionnel) initialSessions pour garder la cohérence
 * ========================================================= */

type Props = {
  email: string;
  questionnaireBase: string;
  initialSessions?: AiSession[]; // ✅ ajouté
};

export default function GenerateClient({ email, questionnaireBase, initialSessions }: Props) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<AiSession[]>(initialSessions ?? []);
  const [error, setError] = useState<string | null>(null);

  // Si initialSessions change (par ex. SSR → client hydration), on met à jour le state
  useEffect(() => {
    if (initialSessions?.length) {
      setSessions(initialSessions);
    }
  }, [initialSessions]);

  // =====================================
  // 🔸 Génération du programme IA (via API)
  // =====================================
  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/programme?email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (data?.sessions?.length) {
        // 🔹 Stocker les séances en cookie (pour affichage dans le dashboard)
        document.cookie = `app_sessions=${JSON.stringify({
          sessions: data.sessions,
        })}; path=/; max-age=${60 * 60 * 24 * 7}`;

        setSessions(data.sessions);
      } else {
        setError("Aucune séance générée.");
      }
    } catch (err: any) {
      console.error("Erreur génération programme:", err);
      setError("Impossible de générer le programme.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h2 className="font-bold text-lg mb-2">Génération du programme IA</h2>
      <p className="text-sm text-gray-600 mb-4">
        Cet outil lit les réponses du formulaire Google Sheet et crée automatiquement
        un programme personnalisé pour <b>{email}</b>.
      </p>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-3 py-2 bg-black text-white rounded-md font-semibold hover:bg-gray-800 transition"
        >
          {loading ? "Génération..." : "Générer le programme"}
        </button>

        <a
          href={questionnaireBase}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-2 bg-gray-100 text-gray-800 rounded-md font-semibold hover:bg-gray-200 transition"
        >
          Ouvrir le questionnaire
        </a>
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      {sessions.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Séances générées :</h3>
          <ul className="space-y-1">
            {sessions.map((s, i) => (
              <li
                key={s.id || i}
                className="text-sm border-b border-gray-200 py-1 flex justify-between items-center"
              >
                <span>
                  <b>{s.title}</b> — {s.type} ({s.plannedMin ?? 45} min)
                </span>
                <a
                  href={`/dashboard/seance/${encodeURIComponent(s.id)}`}
                  className="text-blue-600 hover:underline"
                >
                  Voir
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
