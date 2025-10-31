"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AiSession } from "../../../lib/coach/ai";

type Props = {
  email: string;
  questionnaireBase: string;
  initialSessions?: AiSession[];
};

/* ===== Détection Haut/Bas alignée avec la page détail ===== */
function norm(s?: string) {
  return String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

const TITLE_UPPAT = /\b(haut du corps|upper|push|poitrine|pector|pecs|epaules|eapaule|delto|dos|row|tirage|pull|biceps|triceps)\b/i;
const TITLE_LOWPAT = /\b(bas du corps|lower|jambes|legs|quadriceps|quads|ischios?|fessiers?|glutes?|mollets?|cuisses?|squat|deadlift|souleve de terre|hip thrust|fentes?|split squat|leg press|presse|adducteurs?|abducteurs?)\b/i;

function sessionTitleList(raw?: string, opts: { keepName?: boolean } = { keepName: true }) {
  const s = String(raw || "");
  const name = (s.match(/S[ée]ance\s+pour\s+([^—–-]+)/i)?.[1] || "").trim();
  let t = s.replace(/S[ée]ance\s+pour\s+[^—–-]+[—–-]\s*/i, "");
  t = t.replace(/[—–-]\s*[A-Z]\b/g, "").replace(/·\s*[A-Z]\b/g, "");

  const side =
    TITLE_UPPAT.test(t) && !TITLE_LOWPAT.test(t)
      ? "Haut du corps"
      : TITLE_LOWPAT.test(t) && !TITLE_UPPAT.test(t)
      ? "Bas du corps"
      : "Séance";

  return opts.keepName && name ? `Séance pour ${name} — ${side}` : side;
}

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
            const sessionId = s.id || `custom-${i}`;
            const href = `/dashboard/seance/${encodeURIComponent(sessionId)}`;
            return (
              <li
                key={sessionId}
                onClick={() => router.push(href)}
                className="card hover:bg-gray-50 cursor-pointer transition"
                style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">
                      {sessionTitleList(s.title, { keepName: true })}
                    </div>
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

      {!loading && (!sessions || sessions.length === 0) && (
        <div className="text-sm text-gray-500">Aucune séance disponible pour le moment.</div>
      )}
    </section>
  );
}
