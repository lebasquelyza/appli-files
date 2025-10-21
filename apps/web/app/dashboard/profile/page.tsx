// apps/web/app/dashboard/profile/page.tsx
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  getAnswersForEmail,
  buildProfileFromAnswers,
  generateProgrammeFromAnswers,
  getAiSessions,
  type AiSession as AiSessionT,
  type Profile as ProfileT,
} from "../../../lib/coach/ai";

/** ================= Constantes ================= */
const QUESTIONNAIRE_BASE = "https://questionnaire.files-coaching.com";

/** ================= Types locaux ================= */
type WorkoutType = "muscu" | "cardio" | "hiit" | "mobilité";

/** ================= Utils ================= */
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

function getBaseUrlFromHeaders() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** =============== Email via NextAuth (session) =============== */
async function getSignedInEmail(): Promise<string> {
  try {
    // @ts-ignore optional deps
    const { getServerSession } = await import("next-auth");
    // @ts-ignore optional deps
    const { authOptions } = await import("../../../lib/auth");
    const session = await getServerSession(authOptions as any);
    const mail = (session as any)?.user?.email as string | undefined;
    if (mail) return mail;
  } catch {}
  return cookies().get("app_email")?.value || "";
}

/** =============== Server Action: Générer (optionnel) =============== */
async function doAutogenAction(formData: FormData) {
  "use server";

  // Ici on passe par l’API si tu veux garder le bouton, 
  // mais la page remplit déjà Mes infos directement via Sheets (ci-dessous).
  const c = cookies();
  const user = c.get("fc_uid")?.value || "me";

  let email = "";
  try {
    // @ts-ignore
    const { getServerSession } = await import("next-auth");
    // @ts-ignore
    const { authOptions } = await import("../../../lib/auth");
    const session = await getServerSession(authOptions as any);
    email = ((session as any)?.user?.email as string | undefined) || "";
  } catch {}
  if (!email) email = c.get("app_email")?.value || "";

  const qp = new URLSearchParams({ user, autogen: "1" });
  if (email) qp.set("email", email);

  const url = `${getBaseUrlFromHeaders()}/api/programme?${qp.toString()}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      let msg = "Échec de la génération du programme.";
      try {
        const j = await res.json();
        if (j?.message) msg = j.message;
      } catch {}
      redirect(`/dashboard/profile?error=${encodeURIComponent(msg)}`);
    }
  } catch {
    redirect(`/dashboard/profile?error=${encodeURIComponent("Serveur indisponible pour générer le programme.")}`);
  }

  revalidatePath("/dashboard/profile");
  redirect("/dashboard/profile?success=programme");
}

/** ================= Page ================= */
export default async function Page({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string };
}) {
  // 0) Email prioritaire = connexion (fallback cookie)
  const emailBySession = await getSignedInEmail();
  const cookieEmail = cookies().get("app_email")?.value || "";
  const email = (emailBySession || cookieEmail || "").trim().toLowerCase();

  // 1) MES INFOS : lecture DIRECTE de Sheets avec la logique de ton ancien ai.ts
  let profile: Partial<ProfileT> & { email?: string } = {};
  if (email) {
    try {
      const answers = await getAnswersForEmail(email);
      if (answers) {
        const built = buildProfileFromAnswers(answers);
        profile = { ...built, email: built.email || email };
      } else {
        // Fallback minimal si pas de réponses
        profile = { email };
      }
    } catch {
      profile = { email };
    }
  }

  // ====== Affichage "Mes infos" (Sans le champ Lieu)
  const clientPrenom =
    typeof profile?.prenom === "string" && profile.prenom && !/\d/.test(profile.prenom) ? profile.prenom : "";
  const clientAge = typeof profile?.age === "number" && profile.age > 0 ? profile.age : undefined;
  const clientEmailDisplay = String(profile?.email || email || "");

  const rawGoal = String((profile as any)?.goal || (profile as any)?.objectif || "").toLowerCase();
  const goalLabel = (() => {
    const map: Record<string, string> = {
      hypertrophy: "Hypertrophie / Esthétique",
      fatloss: "Perte de gras",
      strength: "Force",
      endurance: "Endurance / Cardio",
      mobility: "Mobilité / Souplesse",
      general: "Forme générale",
    };
    if (map[rawGoal]) return map[rawGoal];
    if (!rawGoal) return "Non défini";
    return rawGoal;
  })();

  const questionnaireUrl = (() => {
    const qp = new URLSearchParams();
    if (clientEmailDisplay) qp.set("email", clientEmailDisplay);
    if (clientPrenom) qp.set("prenom", clientPrenom);
    const qs = qp.toString();
    return qs ? `${QUESTIONNAIRE_BASE}?${qs}` : QUESTIONNAIRE_BASE;
  })();

  // 2) PROGRAMME : on génère depuis les mêmes réponses (logique ancien ai.ts)
  let aiSessions: AiSessionT[] = [];
  if (email) {
    try {
      const answers = await getAnswersForEmail(email);
      if (answers) {
        aiSessions = generateProgrammeFromAnswers(answers).sessions;
      }
    } catch {}
  }
  // Fallback via lib si besoin (cookie store etc.)
  if ((!aiSessions || aiSessions.length === 0) && email) {
    try {
      aiSessions = await getAiSessions(email);
    } catch {}
  }
  // 🔒 filet de sécurité
  if (!aiSessions || aiSessions.length === 0) {
    aiSessions = [
      {
        id: `generic-${Date.now()}`,
        title: "Séance personnalisée",
        type: "muscu",
        date: new Date().toISOString().slice(0, 10),
        plannedMin: 45,
        intensity: "modérée",
        exercises: [
          { name: "Squat goblet", sets: 3, reps: "10–12", rest: "60–90s", block: "principal" },
          { name: "Rowing haltère", sets: 3, reps: "8–10", rest: "60–90s", block: "principal" },
          { name: "Pompes", sets: 3, reps: "max–2", rest: "60s", block: "principal" },
        ],
      } as AiSessionT,
    ];
  }

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
          href="/dashboard/progress"  // ← Retour vers ta page “progress”
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
        {!!displayedError && (
          <div className="card" style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600, whiteSpace: "pre-wrap" }}>
            ⚠️ {displayedError}
          </div>
        )}
      </div>

      {/* ===== Mes infos (sans Lieu) ===== */}
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
              <b>Prénom :</b> {clientPrenom || <i className="text-gray-400">Non renseigné</i>}
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

      {/* ===== Mon programme (IA SEULEMENT) ===== */}
      <section className="section" style={{ marginTop: 12 }}>
        <div
          className="section-head"
          style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
        >
          <div>
            <h2 style={{ marginBottom: 6 }}>Mon programme</h2>
            <p className="text-sm" style={{ color: "#6b7280" }}>
              Personnalisé via l’analyse de vos réponses (IA).
            </p>
          </div>

          {/* Bouton : Générer (optionnel) */}
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

        {(!aiSessions || aiSessions.length === 0) ? (
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
    </div>
  );
}
