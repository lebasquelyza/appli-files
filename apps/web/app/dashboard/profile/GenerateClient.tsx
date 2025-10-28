// apps/web/app/dashboard/profile/GenerateClient.tsx
"use client";

import { useState } from "react";
import type { AiSession as AiSessionT, Profile as ProfileT, NormalizedExercise } from "../../../lib/coach/ai";
import { planProgrammeFromProfile } from "../../../lib/coach/beton/index";

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

/* ====== Helpers client ====== */
function availabilityFromAnswers(answers: Record<string, any> | null | undefined): string | undefined {
  if (!answers) return undefined;
  const dayPat = /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|week\s*-?\s*end|weekend|jours?\s+par\s+semaine|\b[1-7]\s*(x|fois|jours?)?)/i;
  const candidates: string[] = [];
  for (const k of ["daysPerWeek", "jours", "séances/semaine", "seances/semaine", "col_I", "col_H"]) {
    const v = (answers as any)[k];
    if (typeof v === "string" || typeof v === "number") candidates.push(String(v));
  }
  for (const k of Object.keys(answers)) {
    const v = (answers as any)[k];
    if (typeof v === "string" || typeof v === "number") candidates.push(String(v));
  }
  const hits = candidates.map(v => String(v ?? "").trim()).filter(v => v && dayPat.test(v));
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

/** Transforme une séance en version “sans équipement” côté client */
function toBodyweightVersion(session: AiSessionT): AiSessionT {
  const mapName = (name: string): string => {
    const n = name.toLowerCase();
    if (/front|goblet|squat|presse|leg\s*extension/.test(n)) return "Squat au poids du corps";
    if (/fente|split|lunge/.test(n)) return "Fente arrière au poids du corps";
    if (/hip thrust|glute|pont/.test(n)) return "Hip Thrust au sol";
    if (/souleve|rdl|deadlift|good morning/.test(n)) return "Good morning au poids du corps";
    if (/leg curl|curl ischio/.test(n)) return "Nordic curl assisté";
    if (/bench|developpe|militaire|incline|presse epaule/.test(n)) return "Pompes (mains surélevées si besoin)";
    if (/ecarte/.test(n)) return "Pompes tempo lent";
    if (/rowing|tirage horizontal/.test(n)) return "Tirage serviette sous table";
    if (/tirage vertical|tractions?/.test(n)) return "Tirage horizontal élastique/serviette";
    if (/elevations?/.test(n)) return "Élévations latérales sans charge (tempo lent)";
    if (/curl/.test(n)) return "Curl isométrique serviette";
    if (/triceps/.test(n)) return "Dips entre deux chaises (amplitude confortable)";
    if (/plank|gainage/.test(n)) return "Gainage planche";
    if (/hollow/.test(n)) return "Hollow Hold";
    if (/mollets?|calf/.test(n)) return "Mollets debout au poids du corps";
    if (/poignets?|forearm/.test(n)) return "Farmer carry (charges improvisées)";
    return name;
  };

  const bwEx = (session.exercises || []).map<NormalizedExercise>((e) => {
    const isWeighted = /halt|barre|machine|cable|câble|bench/i.test(e.equipment || "") ||
                       /(squat|bench|developpe|rowing|tirage|curl|extension|kettlebell|kb|barre|halt|mollets|poignets)/i.test(e.name);
    if (!isWeighted) return e;

    const name = mapName(e.name);
    const out: NormalizedExercise = {
      ...e,
      name,
      equipment: "poids du corps",
      tempo: e.tempo || undefined,
      rest: "60–75s",
      reps: e.reps || "10–15",
      sets: e.sets || 3,
    };
    return out;
  });

  return { ...session, exercises: bwEx, title: session.title.replace(/$/, " (sans équipement)") };
}

export default function GenerateClient({ email, questionnaireBase, initialSessions = [] }: Props) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<AiSessionT[]>(initialSessions);
  const [error, setError] = useState<string>("");
  const [bwToggled, setBwToggled] = useState<Record<string, boolean>>({}); // id -> true = sans équipement

  async function onGenerate() {
    try {
      setLoading(true);
      setError("");

      const url = email ? `/api/answers?email=${encodeURIComponent(email)}` : `/api/answers`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      const answers: Record<string, any> | null = data?.answers || null;
      const baseProfile: Partial<ProfileT> = data?.profile || {};

      const profile: any = {
        prenom: baseProfile.prenom,
        age: baseProfile.age,
        objectif: baseProfile.objectif, // <-- libellé brut utilisé côté béton
        goal: baseProfile.goal,
        equipLevel: normEquipLevel(answers?.equipLevel ?? answers?.["matériel"] ?? answers?.["materiel"] ?? answers?.["equipment_level"] ?? answers?.["col_E"]),
        timePerSession:
          toNumber(answers?.timePerSession ?? answers?.["durée"] ?? answers?.["duree"] ?? answers?.["col_F"]) ??
          ((baseProfile.age && (baseProfile.age as number) > 50) ? 35 : undefined) ??
          45,
        level: normLevel(answers?.["niveau"] ?? answers?.["level"] ?? answers?.["experience"] ?? answers?.["expérience"] ?? answers?.["col_D"]),
        injuries: splitList(answers?.["injuries"] ?? answers?.["blessures"] ?? answers?.["col_H"]),
        equipItems: splitList(answers?.["equipItems"] ?? answers?.["équipements"] ?? answers?.["equipements"] ?? answers?.["col_J"]),
        availabilityText: availabilityFromAnswers(answers),
        likes: splitList(answers?.["likes"]),
        dislikes: splitList(answers?.["dislikes"]),
      };

      const daysPerWeek =
        Math.max(1, Math.min(6, toNumber(answers?.["daysPerWeek"] ?? answers?.["jours"] ?? answers?.["séances/semaine"] ?? answers?.["seances/semaine"] ?? answers?.["col_I"]) || 3));

      // ✨ Génération IA (avec équipement selon profil)
      const { sessions } = planProgrammeFromProfile(profile, { maxSessions: daysPerWeek });

      setBwToggled({}); // reset toggles
      setSessions(sessions);
    } catch (e: any) {
      setError("Impossible de générer les séances. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  }

  function onToggleSession(id: string) {
    setBwToggled((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      return next;
    });
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const toggled = !bwToggled[id];
        return toggled ? toBodyweightVersion(s) : { ...s, title: s.title.replace(/\s*\(sans équipement\)\s*$/, "") };
      })
    );
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
            Personnalisé via vos dernières réponses (IA). Cliquez sur le titre d’une séance pour voir la version sans équipement.
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
            const displayTitle = s.title || "Séance";
            const equipped = !/\(sans équipement\)/i.test(displayTitle);

            return (
              <li key={s.id} className="card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      onClick={() => onToggleSession(s.id)}
                      className="font-medium underline-offset-2 hover:underline truncate text-left"
                      style={{ fontSize: 16, display: "inline-block", maxWidth: "100%" }}
                      title="Cliquer pour alterner équipement / sans équipement"
                    >
                      {displayTitle}
                    </button>
                    <div className="text-xs mt-0.5 text-gray-500">
                      <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-1.5 py-0.5 mr-2">
                        IA
                      </span>
                      {s.plannedMin ? `${s.plannedMin} min` : "—"} · {equipped ? "Équipement" : "Sans équipement"}
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
