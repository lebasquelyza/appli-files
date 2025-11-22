// apps/web/app/dashboard/seance/SeanceClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { AiSession as AiSessionT, NormalizedExercise } from "../../../lib/coach/ai";
import { useLanguage } from "@/components/LanguageProvider";
const { t } = useLanguage();


type Props = {
  id: string;
  fallback?: Partial<AiSessionT>;
};

export default function SeanceClient({ id, fallback }: Props) {
  const [session, setSession] = useState<AiSessionT | null>(null);
  const [mode, setMode] = useState<"equip" | "noequip">("equip");
  const { t } = useLanguage(); // ✅

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ai_sessions");
      if (!raw) return;
      const all: AiSessionT[] = JSON.parse(raw);
      const found = all.find((s) => s.id === id);
      if (found) setSession(found);
    } catch {}
  }, [id]);

  const current = useMemo<AiSessionT | null>(() => {
    if (!session) return null;
    if (mode === "equip") return session;
    const mapped: AiSessionT = {
      ...session,
      exercises: (session.exercises || []).map(toNoEquipmentExercise),
    };
    return mapped;
  }, [session, mode]);

  if (!current) {
    return (
      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        <div className="card">
          <h1 className="text-lg font-semibold mb-2">
            {fallback?.title || t("seance.fallback.defaultTitle")}
          </h1>
          <p className="text-sm text-gray-600">
            {t("seance.fallback.detailUnavailable")}
          </p>
          {!!fallback?.plannedMin && (
            <p className="text-sm mt-2">
              {fallback.plannedMin} {t("seance.fallback.minSuffix")}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-semibold">{current.title}</h1>
          <div className="text-sm text-gray-500">
            {current.date} · {current.type} ·{" "}
            {current.plannedMin
              ? `${current.plannedMin} ${t("seance.fallback.minSuffix")}`
              : "—"}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setMode("equip")}
            className={`px-3 py-1 text-sm rounded border ${
              mode === "equip" ? "bg-black text-white" : "bg-white"
            }`}
            title={t("seance.mode.equip.title")}
          >
            {t("seance.mode.equip.label")}
          </button>
          <button
            onClick={() => setMode("noequip")}
            className={`px-3 py-1 text-sm rounded border ${
              mode === "noequip" ? "bg-black text-white" : "bg-white"
            }`}
            title={t("seance.mode.noequip.title")}
          >
            {t("seance.mode.noequip.label")}
          </button>
        </div>
      </div>

      <div className="card">
        <ul className="list-none pl-0 divide-y">
          {(current.exercises || []).map((e, idx) => (
            <li key={idx} className="py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{e.name}</div>
                  <div className="text-xs text-gray-600">
                    {e.block ? `${labelBlock(e.block)} · ` : ""}
                    {e.sets ? `${e.sets} ${t("seance.exercise.setsUnit")}` : ""}
                    {e.sets && e.reps ? " · " : ""}
                    {e.reps || ""}
                    {e.rest ? ` · ${t("seance.exercise.restPrefix")} ${e.rest}` : ""}
                    {e.tempo ? ` · ${t("seance.exercise.tempoPrefix")} ${e.tempo}` : ""}
                    {typeof e.rir === "number"
                      ? ` · ${t("seance.exercise.rirPrefix")} ${e.rir}`
                      : ""}
                  </div>
                  {e.notes && (
                    <div className="text-xs text-gray-500 mt-1">{e.notes}</div>
                  )}
                </div>
                <div className="shrink-0 text-xs text-gray-500">
                  {mode === "equip"
                    ? e.equipment || "—"
                    : t("seance.exercise.bodyweight")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <a href="/dashboard/profile" className="underline text-sm">
          ← Retour
        </a>
      </div>
    </div>
  );
}

function labelBlock(b?: NormalizedExercise["block"]) {
  switch (b) {
    case "echauffement":
      return "Échauffement";
    case "principal":
      return "Principal";
    case "accessoires":
      return "Accessoires";
    case "fin":
      return "Fin";
    default:
      return "";
  }
}

/** Mapping vers des variantes “sans équipement” (robuste et simple) */
function toNoEquipmentExercise(ex: NormalizedExercise): NormalizedExercise {
  const name = (ex.name || "").toLowerCase();
  const base = { ...ex, equipment: "poids du corps" as const };

  // BAS
  if (/goblet|back squat|front squat|squat|presse/.test(name))
    return {
      ...base,
      name: "Squat au poids du corps",
      sets: ex.sets ?? 3,
      reps: ex.reps || "12–20",
      rest: "45–60s",
    };
  if (/fente|split squat/.test(name))
    return {
      ...base,
      name: "Fente arrière (PDC)",
      sets: ex.sets ?? 3,
      reps: ex.reps || "10–12/ côté",
      rest: "45–60s",
    };
  if (/hip thrust/.test(name))
    return {
      ...base,
      name: "Hip Thrust au sol",
      sets: ex.sets ?? 3,
      reps: ex.reps || "12–15",
      rest: "45–60s",
    };
  if (/soulev[ée] de terre|deadlift|rdl|good morning/.test(name))
    return {
      ...base,
      name: "Good Morning (bras croisés)",
      sets: ex.sets ?? 3,
      reps: "12–15",
      rest: "45–60s",
    };
  if (/mollet|calf/.test(name))
    return {
      ...base,
      name: "Mollets debout (PDC)",
      sets: ex.sets ?? 3,
      reps: "15–25",
      rest: "45–60s",
    };

  // HAUT PUSH
  if (/bench|d[ée]velopp[ée]/.test(name) && !/tirage|row/.test(name))
    return {
      ...base,
      name: "Pompes",
      sets: ex.sets ?? 3,
      reps: "max contrôlé",
      rest: "60–75s",
      notes: "Surélever les mains si besoin.",
    };
  if (/ecart[ée]s|fly/.test(name))
    return {
      ...base,
      name: "Pompes mains écartées (amplitude)",
      sets: ex.sets ?? 2,
      reps: "10–15",
      rest: "45–60s",
    };
  if (/triceps/.test(name))
    return {
      ...base,
      name: "Pompes mains serrées",
      sets: ex.sets ?? 3,
      reps: "8–12",
      rest: "45–60s",
    };
  if (/elevations? lat[ée]rales?/.test(name))
    return {
      ...base,
      name: "Pike press (léger)",
      sets: ex.sets ?? 3,
      reps: "6–10",
      rest: "60–75s",
      notes: "Épaules, amplitude confortable.",
    };

  // HAUT PULL
  if (/row|tirage|tractions?/.test(name))
    return {
      ...base,
      name: "Tirage sous table (serviette)",
      sets: ex.sets ?? 3,
      reps: "6–10",
      rest: "60–75s",
      notes: "Table robuste / barre basse.",
    };
  if (/face pull/.test(name))
    return {
      ...base,
      name: "Tirage horizontal (serviette)",
      sets: ex.sets ?? 3,
      reps: "10–12",
      rest: "45–60s",
    };
  if (/biceps|curl/.test(name))
    return {
      ...base,
      name: "Curl isométrique paume contre paume",
      sets: ex.sets ?? 3,
      reps: "20–30s",
      rest: "45–60s",
    };
  if (/avant[- ]?bras|forearm/.test(name))
    return {
      ...base,
      name: "Farmer hold sans charge (isométrie)",
      sets: ex.sets ?? 3,
      reps: "30–45s",
      rest: "45–60s",
    };
  if (/rear delt|arriere d[ée]paules?|post[ée]rieur/.test(name))
    return {
      ...base,
      name: "Reverse snow angels (au sol)",
      sets: ex.sets ?? 3,
      reps: "10–15",
      rest: "45–60s",
    };

  // CORE/HIIT/MOBILITÉ : souvent déjà PDC
  return base;
}

