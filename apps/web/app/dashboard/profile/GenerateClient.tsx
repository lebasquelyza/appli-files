// apps/web/app/dashboard/profile/GenerateClient.tsx
"use client";

import { useState } from "react";
import type { AiSession as AiSessionT, Profile as ProfileT } from "../../../lib/coach/ai";

type Props = {
  email?: string;
  questionnaireBase: string;
  initialSessions?: AiSessionT[]; // on l’ignore (on part vide)
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

/* ========= Helpers pour profil/answers (identiques à avant) ========= */
// ... (garde tes helpers existants: availabilityFromAnswers, normLevel, normEquipLevel, toNumber, splitList, extractDaysList)

export default function GenerateClient({ email, questionnaireBase }: Props) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<AiSessionT[]>([]); // ✅ démarre toujours vide
  const [error, setError] = useState<string>("");

  async function onGenerate() {
    try {
      setLoading(true);
      setError("");

      // 1) Récupère les dernières réponses (inchangé)
      const url = email ? `/api/answers?email=${encodeURIComponent(email)}` : `/api/answers`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      const answers: Record<string, any> | null = data?.answers || null;
      const baseProfile: Partial<ProfileT> = data?.profile || {};

      // 2) Construit le profil (inchangé)
      const profile: any = {
        prenom: baseProfile.prenom,
        age: baseProfile.age,
        objectif: baseProfile.objectif,
        goal: baseProfile.goal,
        // … tes normalisations existantes …
        // availabilityText: availabilityFromAnswers(answers),
      };

      // 3) Appel API preset — on n’affiche QUE ça
      const planRes = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile }), // le serveur décide du nombre via availability/chiffre
      });
      const planJson = await planRes.json();
      if (!planRes.ok) throw new Error(planJson?.error || "Erreur API plan");

      // ✅ On remplace totalement le state par CE QUI VIENT DE L’IA
      setSessions(Array.isArray(planJson.sessions) ? planJson.sessions : []);
    } catch (e: any) {
      setSessions([]); // pas de séances si erreur
      setError("Impossible de générer les séances. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  }

  function onClear() {
    setSessions([]); // 🗑️ supprime tout ce qui est affiché (IA)
    setError("");    // et on enlève l’erreur éventuelle
  }

  const aiSessions = sessions.filter(
    // Optionnel : filtre “séances IA seulement” si besoin d’un garde-fou
    // par exemple si tu veux être SÛR de n’afficher que les ids générés par l’IA/preset
    (s) => s?.id?.startsWith("preset-v1") || s?.id?.startsWith("beton-")
  );

  return (
    <section className="section" style={{ marginTop: 12 }}>
      <div
        className="section-head"
        style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <div>
          <h2 style={{ marginBottom: 6 }}>Mon programme</h2>
          <p className="text-sm" style={{ color: "#6b7280" }}>
            Uniquement les séances générées par l’IA. En cas d’erreur, elle s’affiche ci-dessous.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClear}
            disabled={loading || aiSessions.length === 0}
            className="btn"
            style={{ background: "#ffffff", color: "#111827", border: "1px solid #d1d5db", fontWeight: 600, padding: "6px 10px", lineHeight: 1.2, borderRadius: 8 }}
            title="Supprimer les séances IA affichées"
          >
            🗑️ Effacer
          </button>
          <button
            onClick={onGenerate}
            disabled={loading}
            className="btn"
            style={{ background: "#111827", color: "#ffffff", border: "1px solid #d1d5db", fontWeight: 600, padding: "6px 10px", lineHeight: 1.2, borderRadius: 8 }}
            title="Génère/Met à jour ton programme (IA)"
          >
            {loading ? "⏳ Génération..." : "⚙️ Générer"}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="card text-sm"
          style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600 }}
        >
          ⚠️ {error}
        </div>
      )}

      {aiSessions.length === 0 && !error && (
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
      )}

      {aiSessions.length > 0 && (
        <ul className="space-y-2 list-none pl-0">
          {aiSessions.map((s) => {
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

