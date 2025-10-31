// apps/web/app/dashboard/seance/[id]/page.tsx
import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAnswersForEmail,
  buildProfileFromAnswers,
  generateProgrammeFromAnswers,
  type AiSession,
  type NormalizedExercise,
  type WorkoutType,
} from "../../../../lib/coach/ai";

/* =============== Utils =============== */
async function getSignedInEmail(): Promise<string> {
  try {
    // @ts-ignore optional
    const { getServerSession } = await import("next-auth");
    // @ts-ignore optional
    const { authOptions } = await import("../../../../lib/auth");
    const session = await getServerSession(authOptions as any);
    const email = (session as any)?.user?.email as string | undefined;
    if (email) return email;
  } catch {}
  return cookies().get("app_email")?.value || "";
}

function normalizeWorkoutType(input?: string): WorkoutType {
  const s = String(input || "").trim().toLowerCase();
  if (["cardio", "endurance"].includes(s)) return "cardio";
  if (["hiit", "metcon", "wod"].includes(s)) return "hiit";
  if (["mobilite", "mobilité"].includes(s)) return "mobilité";
  return "muscu";
}

function genericFallback(type: WorkoutType): NormalizedExercise[] {
  if (type === "cardio")
    return [
      { name: "Échauffement Z1", reps: "8–10 min", block: "echauffement" },
      { name: "Cardio continu Z2", reps: "25–35 min", block: "principal" },
      { name: "Retour au calme", reps: "5–8 min", block: "fin" },
    ];
  if (type === "mobilité")
    return [
      { name: "Respiration diaphragmatique", reps: "3 min", block: "echauffement" },
      { name: "90/90 hanches", reps: "10/ côté", block: "principal" },
      { name: "T-spine rotations", reps: "10/ côté", block: "principal" },
      { name: "Down-Dog → Cobra", reps: "6–8", block: "fin" },
    ];
  return [
    { name: "Goblet Squat", sets: 3, reps: "8–12", rest: "75–90s", block: "principal" },
    { name: "Développé haltères", sets: 3, reps: "8–12", rest: "75–90s", block: "principal" },
    { name: "Rowing unilatéral", sets: 3, reps: "10–12/ côté", rest: "75s", block: "principal" },
    { name: "Gainage", sets: 2, reps: "30–45s", rest: "45s", block: "fin" },
  ];
}

/** Nettoie un texte pour ne garder que l’info utile (supprime RIR/tempo). */
function cleanText(s?: string): string {
  if (!s) return "";
  return String(s)
    .replace(/(?:^|\s*[·•\-|,]\s*)RIR\s*\d+(?:\.\d+)?/gi, "")
    .replace(/\b[0-4xX]{3,4}\b/g, "") // tempos 3011/30X1
    .replace(/Tempo\s*:\s*[0-4xX]{3,4}/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[·•\-|,]\s*$/g, "")
    .trim();
}

/* =============== Data loader (IA) =============== */
async function loadData(id: string) {
  const email = await getSignedInEmail();
  if (!email) return null;

  const answers = await getAnswersForEmail(email);
  if (!answers) return null;

  const profile = buildProfileFromAnswers(answers);
  const prog = generateProgrammeFromAnswers(answers); // 🧠 IA ici
  const sessions = prog.sessions || [];

  // on essaie d’abord l’id exact, sinon on prend la 1re séance
  const base =
    sessions.find((s) => s.id === id) ||
    sessions.find((s) => encodeURIComponent(s.id) === id) ||
    sessions[0];

  if (!base) {
    // filet
    return {
      base: { id, title: "Séance", type: "muscu", date: "", plannedMin: 45 } as AiSession,
      profile,
      exercises: genericFallback("muscu"),
    };
  }

  return {
    base,
    profile,
    exercises: base.exercises?.length ? base.exercises : genericFallback(base.type),
  };
}

/* =============== Styles =============== */
const styles = String.raw`
  .wrap { max-width: 720px; margin: 0 auto; padding: 16px 12px 40px; }
  .top { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
  .back { font-size:13px; color:#2563eb; text-decoration:underline; }
  .meta { font-size:13px; color:#6b7280; margin-top:4px; }
  .card { background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:12px 12px; }
  .section { margin-top:14px; }
  .section h3 { font-size:14px; font-weight:800; margin:0 0 8px 0; color:#111827; }
  .exo { display:flex; align-items:flex-start; justify-content:space-between; padding:10px 0; }
  .exo + .exo { border-top:1px solid #f1f5f9; }
  .name { font-weight:700; font-size:15px; color:#111827; }
  .line { font-size:13px; color:#374151; margin-top:2px; }
`;

/* =============== Page =============== */
export default async function Page({
  params,
}: {
  params: { id: string };
}) {
  const id = decodeURIComponent(params?.id ?? "");
  if (!id) redirect("/dashboard/profile?error=Seance%20introuvable");

  const data = await loadData(id);
  if (!data) redirect("/dashboard/profile?error=Seance%20introuvable");

  const { base, profile, exercises } = data;

  // libellé objectif concis
  const goal =
    (profile.goal === "hypertrophy" && "Hypertrophie") ||
    (profile.goal === "fatloss" && "Perte de gras") ||
    (profile.goal === "strength" && "Force") ||
    (profile.goal === "mobility" && "Mobilité") ||
    "Forme générale";

  // regroupe par blocs pour des sections propres
  const blockOrder: Record<string, number> = { echauffement: 0, principal: 1, accessoires: 2, fin: 3 };
  const blockNames: Record<string, string> = {
    echauffement: "Échauffement",
    principal: "Bloc principal",
    accessoires: "Accessoires",
    fin: "Fin / retour au calme",
  };
  const sorted = exercises.slice().sort((a, b) => {
    const A = a.block ? blockOrder[a.block] ?? 99 : 50;
    const B = b.block ? blockOrder[b.block] ?? 99 : 50;
    return A - B;
  });

  const groups: Record<string, NormalizedExercise[]> = {};
  for (const ex of sorted) {
    const k = ex.block || "principal";
    (groups[k] ||= []).push(ex);
  }

  return (
    <div className="wrap">
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* header compact */}
      <div className="top">
        <a className="back" href="/dashboard/profile">← Retour</a>
        <div className="meta">Programme IA</div>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15, marginBottom: 2 }}>
        {base.title}
      </h1>
      <div className="meta">
        {base.type} · {base.plannedMin ?? 45} min
      </div>

      {/* objectif + conseil (très simple) */}
      <div className="section">
        <div className="card">
          <div style={{ fontSize: 14 }}><b>Objectif :</b> {goal}</div>
          <div className="meta" style={{ marginTop: 4 }}>
            <b>Conseil :</b>{" "}
            {base.type === "muscu"
              ? "Contrôle propre, 1–2 reps en réserve."
              : base.type === "cardio"
              ? "Reste en zone 2 (respiration aisée)."
              : base.type === "hiit"
              ? "Explosif mais technique propre."
              : "Mouvements lents et contrôlés."}
          </div>
        </div>
      </div>

      {/* sections: on n’affiche QUE séries · reps · repos */}
      {["echauffement", "principal", "accessoires", "fin"].map((k) => {
        const list = groups[k] || [];
        if (!list.length) return null;

        return (
          <div key={k} className="section">
            <h3>{blockNames[k]}</h3>
            <div className="card">
              {list.map((ex, i) => {
                const repsRaw = ex.reps ? String(ex.reps) : ex.durationSec ? `${ex.durationSec}s` : "";
                const reps = cleanText(repsRaw);
                const rest = cleanText(ex.rest || "");
                const sets = typeof ex.sets === "number" ? `${ex.sets} séries` : "";

                // ligne “séries · reps · Repos …” (seuls éléments demandés)
                const line = [sets, reps ? reps : "", rest ? `Repos ${rest}` : ""]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <div key={`${k}-${i}`} className="exo">
                    <div>
                      <div className="name">{ex.name}</div>
                      <div className="line">{line || "—"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

