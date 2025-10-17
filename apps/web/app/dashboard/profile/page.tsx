// apps/web/app/dashboard/profile/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { AiSession as AiSessionT } from "../../../lib/coach/ai";

/** ================= Constantes ================= */
const QUESTIONNAIRE_BASE = "https://questionnaire.files-coaching.com";

type WorkoutType = "muscu" | "cardio" | "hiit" | "mobilité";

type Workout = {
  id: string;
  title: string;
  type: WorkoutType;
  status: "active" | "done";
  date: string;
  plannedMin?: number;
  startedAt?: string;
  endedAt?: string;
  note?: string;
  createdAt: string;
};

type Store = { sessions: Workout[] };

/** ================= Utils ================= */
function parseStore(val?: string | null): Store {
  if (!val) return { sessions: [] };
  try {
    const o = JSON.parse(val!);
    if (Array.isArray(o?.sessions)) return { sessions: o.sessions as Workout[] };
  } catch {}
  return { sessions: [] };
}

function fmtDateISO(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  } catch {}
  return iso || "—";
}

function typeBadgeClass(t: WorkoutType) {
  switch (t) {
    case "muscu":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "cardio":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    case "hiit":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "mobilité":
      return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
  }
}

/** =============== Server Action: Générer (stocke dans Redis via l'API) =============== */
async function doAutogenAction(formData: FormData) {
  "use server";

  const c = cookies();
  const user = c.get("fc_uid")?.value || "me";
  const email = c.get("app_email")?.value || "";

  const qp = new URLSearchParams({ user, autogen: "1" });
  if (email) qp.set("email", email);

  const base =
    process.env.APP_BASE_URL?.replace(/\/+$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/+$/, "") ||
    "http://localhost:3000";

  const url = `${base}/api/programme?${qp.toString()}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      let msg = "Échec de la génération du programme.";
      try {
        const j = await res.json();
        if (j?.message) msg = j.message;
        if (j?.error === "NO_EMAIL") msg = "Email requis pour générer le programme.";
        if (j?.error === "NO_SHEETS_ANSWERS") msg = "Aucune réponse de questionnaire trouvée.";
      } catch {}
      redirect(`/dashboard/profile?error=${encodeURIComponent(msg)}`);
    }
  } catch {
    redirect(`/dashboard/profile?error=${encodeURIComponent("Serveur indisponible pour générer le programme.")}`);
  }

  revalidatePath("/dashboard/profile");
  redirect("/dashboard/profile?success=programme");
}

/** ================= Helpers: chargement depuis l'API (Redis) ================= */
type ProgrammeFromApi = {
  sessions: AiSessionT[];
  profile?: {
    email: string;
    prenom?: string;
    age?: number;
    goal?: string; // on l'affiche via map
    timePerSession?: number;
  } & Record<string, any>;
};

async function fetchProgrammeFromApi(): Promise<ProgrammeFromApi | null> {
  const c = cookies();
  const user = c.get("fc_uid")?.value || "me";
  const base =
    process.env.APP_BASE_URL?.replace(/\/+$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/+$/, "") ||
    "http://localhost:3000";
  const res = await fetch(`${base}/api/programme?user=${encodeURIComponent(user)}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as ProgrammeFromApi | null;
}

function goalLabelFromKey(g?: string) {
  const map: Record<string, string> = {
    hypertrophy: "Hypertrophie / Esthétique",
    fatloss: "Perte de gras",
    strength: "Force",
    endurance: "Endurance / Cardio",
    mobility: "Mobilité / Souplesse",
    general: "Forme générale",
  };
  return g ? (map[g] || "Non défini") : "Non défini";
}

/** ================= Page ================= */
export default async function Page({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string; done?: string; deleted?: string };
}) {
  const c = cookies();

  // Séances "faites" stockées en local (cookie)
  const store = parseStore(c.get("app_sessions")?.value);
  const past = store.sessions
    .filter((s) => s.status === "done")
    .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""));

  // ✅ Charge le programme + profil depuis l'API (=> Redis)
  const prog = await fetchProgrammeFromApi();
  const aiSessions: AiSessionT[] = Array.isArray(prog?.sessions) ? prog!.sessions : [];

  // Infos profil persistantes (affichées même si Sheets n'est pas dispo)
  const p = prog?.profile || {};
  const clientPrenom = (typeof p.prenom === "string" && p.prenom && !/\d/.test(p.prenom)) ? p.prenom : "";
  const clientAge = (typeof p.age === "number" && p.age > 0) ? p.age : undefined;
  const clientEmailDisplay = (typeof p.email === "string" && p.email) ? p.email : (c.get("app_email")?.value || "");
  const goalLabel = goalLabelFromKey((p as any).goal);

  // URL questionnaire pré-rempli
  const questionnaireUrl = (() => {
    const qp = new URLSearchParams();
    if (clientEmailDisplay) qp.set("email", clientEmailDisplay);
    if (clientPrenom) qp.set("prenom", clientPrenom);
    const qs = qp.toString();
    return qs ? `${QUESTIONNAIRE_BASE}?${qs}` : QUESTIONNAIRE_BASE;
  })();

  const displayedError = searchParams?.error || "";
  const displayedSuccess = searchParams?.success || "";

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32, fontSize: "var(--settings-fs, 12px)" }}>
      <div className="page-header">
        <div>
          <h1 className="h1" style={{ fontSize: 22 }}>
            Mon profil
          </h1>
        </div>
        <a
          href="/dashboard"
          className="btn"
          style={{
            background: "#ffffff",
            color: "#111827",
            border: "1px solid #d1d5db",
            fontWeight: 500,
            padding: "6px 10px",
            lineHeight: 1.2,
          }}
        >
          ← Retour
        </a>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {!!displayedSuccess && (
          <div className="card" style={{ border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", fontWeight: 600 }}>
            {displayedSuccess === "programme" ? "✓ Programme IA mis à jour." : "✓ Opération réussie."}
          </div>
        )}
        {!!searchParams?.done && (
          <div className="card" style={{ border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.08)", fontWeight: 600 }}>
            ✓ Séance terminée.
          </div>
        )}
        {!!searchParams?.deleted && (
          <div className="card" style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600 }}>
            Séance supprimée.
          </div>
        )}
        {!!displayedError && (
          <div className="card" style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600, whiteSpace: "pre-wrap" }}>
            ⚠️ {displayedError}
          </div>
        )}
      </div>

      {/* ===== Mes infos (persistantes via Redis) ===== */}
      <section className="section" style={{ marginTop: 12 }}>
        <div
          className="section-head"
          style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
        >
          <h2>Mes infos</h2>
        </div>

        <div className="card">
          <div className="text-sm" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>
              <b>Prénom :</b>{" "}
              {clientPrenom ? clientPrenom : <i className="text-gray-400">Non renseigné</i>}
            </span>
            <span>
              <b>Âge :</b>{" "}
              {typeof clientAge === "number" ? `${clientAge} ans` : <i className="text-gray-400">Non renseigné</i>}
            </span>
            <span>
              <b>Objectif actuel :</b> {goalLabel || <i className="text-gray-400">Non défini</i>}
            </span>
          </div>

          <div
            className="text-sm"
            style={{ marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            title={clientEmailDisplay || "Non renseigné"}
          >
            <b>Mail :</b>{" "}
            {clientEmailDisplay ? (
              <a href={`mailto:${clientEmailDisplay}`} className="underline">
                {clientEmailDisplay}
              </a>
            ) : (
              <span className="text-gray-400">Non renseigné</span>
            )}
          </div>

          {/* Lien vers questionnaire */}
          <div className="text-sm" style={{ marginTop: 10 }}>
            <a href={questionnaireUrl} className="underline">
              Mettre à jour mes réponses au questionnaire
            </a>
          </div>
        </div>
      </section>

      {/* ===== Mon programme (sessions stockées) ===== */}
      <section className="section" style={{ marginTop: 12 }}>
        <div
          className="section-head"
          style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
        >
          <div>
            <h2 style={{ marginBottom: 6 }}>Mon programme</h2>
            <p className="text-sm" style={{ color: "#6b7280" }}>
              Personnalisé via l’analyse de vos réponses.
            </p>
          </div>

          {/* Bouton : Générer dans le bloc Programme */}
          <form action={doAutogenAction}>
            <button
              type="submit"
              className="btn"
              style={{
                background: "#111827",
                color: "#ffffff",
                border: "1px solid #d1d5db",
                fontWeight: 600,
                padding: "6px 10px",
                lineHeight: 1.2,
                borderRadius: 8,
              }}
              title="Génère/Met à jour ton programme personnalisé"
            >
              ⚙️ Générer
            </button>
          </form>
        </div>

        {aiSessions.length === 0 ? (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🤖</span>
              <span>
                Pas encore de séances.{" "}
                <a className="link underline" href={QUESTIONNAIRE_BASE}>
                  Remplissez le questionnaire
                </a>{" "}
                puis cliquez sur « Générer ».
              </span>
            </div>
          </div>
        ) : (
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
                    <a
                      href={href}
                      className="font-medium underline-offset-2 hover:underline truncate"
                      style={{ fontSize: 16, display: "inline-block", maxWidth: "100%" }}
                      title={s.title}
                    >
                      {s.title}
                    </a>
                    <span
                      className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(
                        s.type as WorkoutType
                      )}`}
                    >
                      {s.type}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ===== Séances enregistrées ===== */}
      <section className="section" style={{ marginTop: 12 }}>
        <div
          className="section-head"
          style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <h2>Séances enregistrées</h2>
          {past.length > 12 && (
            <span className="text-xs" style={{ color: "#6b7280" }}>
              Affichage des 12 dernières
            </span>
          )}
        </div>

        {past.length === 0 ? (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🗓️</span>
              <span>Aucune séance enregistrée.</span>
            </div>
          </div>
        ) : (
          <ul className="card divide-y list-none pl-0">
            {past.slice(0, 12).map((s) => {
              const qp = new URLSearchParams({
                title: s.title,
                date: s.date,
                type: s.type,
                plannedMin: s.plannedMin ? String(s.plannedMin) : "",
              });
              const href = `/dashboard/seance/${encodeURIComponent(s.id)}?${qp.toString()}`;

              return (
                <li key={s.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <a href={href} className="font-medium underline-offset-2 hover:underline" style={{ fontSize: 16 }}>
                        {s.title}
                      </a>
                      <div className="text-sm" style={{ color: "#6b7280" }}>
                        {fmtDateISO(s.endedAt)}
                        {s.plannedMin ? ` (prévu ${s.plannedMin} min)` : ""}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(
                        s.type
                      )}`}
                    >
                      {s.type}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
