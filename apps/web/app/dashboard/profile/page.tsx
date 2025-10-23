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

const QUESTIONNAIRE_BASE =
  process.env.FILES_COACHING_QUESTIONNAIRE_BASE || "https://questionnaire.files-coaching.com";

type WorkoutType = "muscu" | "cardio" | "hiit" | "mobilité";

/* UI */
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

/* Email fallback: session Supabase côté serveur si cookie absent */
async function getEmailFromSupabaseSession(): Promise<string> {
  try {
    const { createServerClient } = await import("@supabase/ssr");
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email?.trim().toLowerCase() || "";
  } catch {
    return "";
  }
}

/* Server Action */
async function doAutogenAction(formData: FormData) {
  "use server";
  const c = cookies();
  const user = c.get("fc_uid")?.value || "me";

  // email = cookie en priorité, sinon session supabase
  const cookieEmail = (c.get("app_email")?.value || "").trim().toLowerCase();
  const sessionEmail = cookieEmail || (await getEmailFromSupabaseSession());

  const qp = new URLSearchParams({ user, autogen: "1" });
  if (sessionEmail) qp.set("email", sessionEmail);

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

/* Loaders
 * - Mail affiché = cookie app_email > session Supabase
 * - Prenom/Âge/Objectif = UNIQUEMENT depuis le Sheet (B,C,G)
 * - ?blank=1 masque tout
 */
async function loadProfile(searchParams?: Record<string, string | string[] | undefined>) {
  const forceBlank = ["1", "true", "yes"].includes(
    String(searchParams?.blank || searchParams?.empty || "").toLowerCase()
  );

  const cookieEmail = (cookies().get("app_email")?.value || "").trim().toLowerCase();
  const sessionEmail = cookieEmail || (await getEmailFromSupabaseSession());
  const emailForDisplay = sessionEmail;

  if (forceBlank) {
    return {
      emailForDisplay: "",
      profile: {} as Partial<ProfileT>,
      debugInfo: { email: emailForDisplay || "", sheetHit: false, reason: "Force blank via ?blank=1" },
      forceBlank,
    };
  }

  let profile: Partial<ProfileT> & { email?: string } = {};
  const debugInfo: { email: string; sheetHit: boolean; reason?: string } = {
    email: emailForDisplay || "",
    sheetHit: false,
  };

  if (!emailForDisplay) {
    debugInfo.reason = "Pas d'email (cookie + session vides)";
    return { emailForDisplay: "", profile, debugInfo, forceBlank };
  }

  try {
    const answers = await getAnswersForEmail(emailForDisplay);
    if (answers) {
      // buildProfileFromAnswers doit mapper B->prenom, C->age, G->objectif/goal
      const built = buildProfileFromAnswers(answers);
      profile = { ...built, email: built.email || emailForDisplay };
      debugInfo.sheetHit = true;
    } else {
      profile = { email: emailForDisplay };
      debugInfo.reason = "Aucune réponse trouvée dans le Sheet";
    }
  } catch (e: any) {
    profile = { email: emailForDisplay };
    debugInfo.reason = `Erreur lecture Sheet: ${String(e?.message || e)}`;
  }

  profile.email = emailForDisplay;
  return { emailForDisplay, profile, debugInfo, forceBlank };
}

async function loadSessions(email?: string): Promise<AiSessionT[]> {
  let aiSessions: AiSessionT[] = [];
  if (email) {
    try {
      const answers = await getAnswersForEmail(email);
      if (answers) aiSessions = generateProgrammeFromAnswers(answers).sessions;
    } catch {}
  }
  if ((!aiSessions || aiSessions.length === 0) && email) {
    try {
      aiSessions = await getAiSessions(email);
    } catch {}
  }
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
  return aiSessions;
}

/* Page */
export default async function Page({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string; debug?: string; blank?: string; empty?: string };
}) {
  const { emailForDisplay, profile, debugInfo, forceBlank } = await loadProfile(searchParams);
  const aiSessions = await loadSessions(emailForDisplay);

  const showPlaceholders = !forceBlank;

  const p = (profile ?? {}) as Partial<ProfileT>;
  const clientPrenom =
    typeof p?.prenom === "string" && p.prenom && !/\d/.test(p.prenom) ? p.prenom : "";
  const clientAge = typeof p?.age === "number" && p.age > 0 ? p.age : undefined;

  const goalLabel = (() => {
    const g = String((p as any)?.objectif || (p as any)?.goal || "").toLowerCase();
    const map: Record<string, string> = {
      hypertrophy: "Hypertrophie / Esthétique",
      fatloss: "Perte de gras",
      strength: "Force",
      endurance: "Endurance / Cardio",
      mobility: "Mobilité / Souplesse",
      general: "Forme générale",
    };
    if (!g) return "";
    return map[g] || (p as any)?.objectif || "";
  })();

  const questionnaireUrl = (() => {
    const qp = new URLSearchParams();
    if (emailForDisplay) qp.set("email", emailForDisplay);
    if (clientPrenom) qp.set("prenom", clientPrenom);
    const qs = qp.toString();
    return qs ? `${QUESTIONNAIRE_BASE}?${qs}` : QUESTIONNAIRE_BASE;
  })();

  const displayedError = searchParams?.error || "";
  const displayedSuccess = searchParams?.success || "";
  const showDebug = String(searchParams?.debug || "") === "1";

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32, fontSize: "var(--settings-fs, 12px)" }}>
      <div className="page-header">
        <div>
          <h1 className="h1" style={{ fontSize: 22 }}>
            Mon profil
          </h1>
          {showDebug && (
            <div className="text-xs" style={{ marginTop: 4, color: "#6b7280" }}>
              <b>Debug:</b> email = <code>{emailForDisplay || "—"}</code>{" "}
              {debugInfo.sheetHit ? "· Sheet OK" : `· ${debugInfo.reason || "Sheet KO"}`}
              {forceBlank ? " · BLANK MODE" : ""}
            </div>
          )}
        </div>
        <a
          href="/dashboard/progress"
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
          <div
            className="card"
            style={{
              border: "1px solid rgba(16,185,129,.35)",
              background: "rgba(16,185,129,.08)",
              fontWeight: 600,
            }}
          >
            {displayedSuccess === "programme"
              ? <>✓ Ton programme a été généré avec tes <b>dernières réponses</b> au questionnaire.</>
              : "✓ Opération réussie."}
          </div>
        )}

        {!!displayedError && (
          <div
            className="card"
            style={{
              border: "1px solid rgba(239,68,68,.35)",
              background: "rgba(239,68,68,.08)",
              fontWeight: 600,
              whiteSpace: "pre-wrap",
            }}
          >
            ⚠️ {displayedError}
          </div>
        )}
      </div>

      {/* ===== Mes infos ===== */}
      <section className="section" style={{ marginTop: 12 }}>
        <div
          className="section-head"
          style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
        >
          <h2>Mes infos</h2>
        </div>

        <div className="card">
          <div className="text-sm" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {/* Prénom (Sheet B) */}
            {(clientPrenom || showPlaceholders) && (
              <span>
                <b>Prénom :</b>{" "}
                {clientPrenom || (showPlaceholders ? <i className="text-gray-400">Non renseigné</i> : null)}
              </span>
            )}

            {/* Âge (Sheet C) */}
            {(typeof clientAge === "number" || showPlaceholders) && (
              <span>
                <b>Âge :</b>{" "}
                {typeof clientAge === "number"
                  ? `${clientAge} ans`
                  : showPlaceholders
                  ? <i className="text-gray-400">Non renseigné</i>
                  : null}
              </span>
            )}

            {/* Objectif (Sheet G) */}
            {(goalLabel || showPlaceholders) && (
              <span>
                <b>Objectif actuel :</b>{" "}
                {goalLabel || (showPlaceholders ? <i className="text-gray-400">Non défini</i> : null)}
              </span>
            )}
          </div>

          {/* Mail (cookie -> fallback session) */}
          {(emailForDisplay || showPlaceholders) && (
            <div
              className="text-sm"
              style={{ marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              title={emailForDisplay || (showPlaceholders ? "Non renseigné" : "")}
            >
              <b>Mail :</b>{" "}
              {emailForDisplay ? (
                <a href={`mailto:${emailForDisplay}`} className="underline">
                  {emailForDisplay}
                </a>
              ) : showPlaceholders ? (
                <span className="text-gray-400">Non renseigné</span>
              ) : null}
            </div>
          )}

          <div className="text-sm" style={{ marginTop: 10 }}>
            <a href={questionnaireUrl} className="underline">
              Mettre à jour mes réponses au questionnaire
            </a>
          </div>
        </div>
      </section>

      {/* ===== Mon programme ===== */}
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
