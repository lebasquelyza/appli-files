
"use client";

import { useState } from "react";
import type { AiSession as AiSessionT, Profile as ProfileT } from "../../../lib/coach/ai";
// ✅ Utilise le fichier corrigé (index.ts)
import { planProgrammeFromProfile } from "../../../lib/coach/beton";

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

/* ========= Helpers client (mêmes règles que côté serveur) ========= */
function availabilityFromAnswers(answers: Record<string, any> | null | undefined): string | undefined {
  if (!answers) return undefined;
  const pat =
    /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|week\s*-?\s*end|weekend|\b[1-7]\s*(x|fois|j|jrs|jour|jours)(\s*(par|\/)\s*(semaine|sem))?|\b[1-7]\b)/i;
  const bag: string[] = [];
  for (const k of ["col_H", "daysPerWeek", "jours", "séances/semaine", "seances/semaine", "col_I"]) {
    const v = (answers as any)[k];
    if (typeof v === "string" || typeof v === "number") bag.push(String(v));
  }
  for (const k of Object.keys(answers)) {
    const v = (answers as any)[k];
    if (typeof v === "string" || typeof v === "number") bag.push(String(v));
  }
  const hits = bag.map(v => String(v ?? "").trim()).filter(v => v && pat.test(v));
  return hits.length ? hits.join(" ; ") : undefined;
}

function normLevel(s: string | undefined) {
  const v = String(s || "").toLowerCase();
  if (/avanc/.test(v)) return "avance";
  if (/inter/.test(v)) return "intermediaire";
  if (/deb|déb/.test(v)) return "debutant";
  return undefined as any;
}
function normEquipLevel(s: string | undefined): "none" | "limited" | "full" {
  const v = String(s || "").toLowerCase();
  if (/none|aucun|sans/.test(v)) return "none";
  if (/full|complet|salle|gym|machines|barres/.test(v)) return "full";
  if (!v) return "limited";
  return "limited";
}
function toNumber(x: any): number | undefined {
  const n = Number(String(x ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
function splitList(s: any): string[] | undefined {
  const txt = String(s || "").trim();
  if (!txt) return undefined;
  return txt.split(/[;,/|]/).map((t) => t.trim()).filter(Boolean);
}
function inferMaxSessionsFromText(text?: string | null): number | undefined {
  if (!text) return undefined;
  const s = String(text).toLowerCase();
  const range = s.match(/\b([1-7])\s*-\s*([1-7])\b/);
  if (range) {
    const hi = Math.max(parseInt(range[1], 10), parseInt(range[2], 10));
    return Math.max(1, Math.min(6, hi));
  }
  const withUnit = s.match(/\b([1-7])\s*(x|fois|j|jrs|jour|jours)(\s*(par|\/)\s*(semaine|sem))?\b/);
  if (withUnit) {
    const n = parseInt(withUnit[1], 10);
    return Math.max(1, Math.min(6, n));
  }
  const solo = s.match(/\b([1-7])\b/);
  if (solo) {
    const n = parseInt(solo[1], 10);
    return Math.max(1, Math.min(6, n));
  }
  if (/toute?\s+la\s+semaine|tous?\s+les\s+jours/.test(s)) return 6;
  const days = (() => {
    const out: string[] = [];
    const push = (d: string) => { if (!out.includes(d)) out.push(d); };
    if (/week\s*-?\s*end|weekend/.test(s)) { push("samedi"); push("dimanche"); }
    for (const d of ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"]) {
      if (new RegExp(`\\b${d}\\b`, "i").test(s)) push(d);
    }
    return out;
  })();
  if (days.length) return Math.max(1, Math.min(6, days.length));
  return undefined;
}

/* ================================================================ */

export default function GenerateClient({ email, questionnaireBase, initialSessions = [] }: Props) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<AiSessionT[]>(initialSessions);
  const [error, setError] = useState<string>("");

  async function onGenerate() {
    try {
      setLoading(true);
      setError("");

      const url = email ? `/api/answers?email=${encodeURIComponent(email)}` : `/api/answers`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      const answers: Record<string, any> | null = data?.answers || null;
      const baseProfile: Partial<ProfileT> = data?.profile || {};

      const availabilityText = availabilityFromAnswers(answers);
      const inferred = inferMaxSessionsFromText(availabilityText);

      const structuredDays =
        toNumber(
          answers?.["daysPerWeek"] ??
          answers?.["jours"] ??
          answers?.["séances/semaine"] ??
          answers?.["seances/semaine"] ??
          answers?.["col_I"]
        );
      const daysPerWeek = Math.max(1, Math.min(6, structuredDays ?? inferred ?? 3));

      // ✅ Objectif brut : on couvre plusieurs sources coté client
      const objectifBrut =
        baseProfile.objectif ??
        answers?.["objectif"] ??
        answers?.["objective"] ??
        answers?.["col_G"] ??
        answers?.["goalDisplay"] ??
        "";

      const profile: any = {
        prenom: baseProfile.prenom,
        age: baseProfile.age,
        objectif: objectifBrut,
        goal: baseProfile.goal,
        equipLevel: normEquipLevel(
          answers?.equipLevel ??
          answers?.["matériel"] ??
          answers?.["materiel"] ??
          answers?.["equipment_level"] ??
          answers?.["col_E"]
        ),
        timePerSession:
          toNumber(answers?.timePerSession ?? answers?.["durée"] ?? answers?.["duree"] ?? answers?.["col_F"]) ??
          ((baseProfile.age && (baseProfile.age as number) > 50) ? 35 : undefined) ??
          45,
        level: normLevel(
          answers?.["niveau"] ??
          answers?.["level"] ??
          answers?.["experience"] ??
          answers?.["expérience"] ??
          answers?.["col_D"]
        ),
        injuries: splitList(answers?.["injuries"] ?? answers?.["blessures"] ?? answers?.["col_H"]),
        equipItems: splitList(answers?.["equipItems"] ?? answers?.["équipements"] ?? answers?.["equipements"] ?? answers?.["col_J"]),
        availabilityText,
        likes: splitList(answers?.["likes"]),
        dislikes: splitList(answers?.["dislikes"]),
      };

      const { sessions } = planProgrammeFromProfile(profile, { maxSessions: daysPerWeek });
      setSessions(sessions);
    } catch (e: any) {
      console.error("[GenerateClient] onGenerate error", e);
      setError("Impossible de générer les séances. Réessaie dans un instant.");
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
            Personnalisé via vos dernières réponses (IA côté client).
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
          style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600 }}
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

            const displayTitle = (s.title || "").replace(/^(S[eé]ance)\s+de\b/i, "Séances pour");

            return (
              <li key={s.id} className="card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={href}
                      className="font-medium underline-offset-2 hover:underline truncate"
                      style={{ fontSize: 16, display: "inline-block", maxWidth: "100%" }}
                      title={displayTitle}
                    >
                      {displayTitle}
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
