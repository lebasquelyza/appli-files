// apps/web/app/dashboard/profile/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProgrammeForUser, getAnswersForEmail, buildProfileFromAnswers, type AiSession as AiSessionT } from "../../../lib/coach/ai";


/** ================= ENV ================= */
const QUESTIONNAIRE_BASE = "https://questionnaire.files-coaching.com";

/** ================= Types locaux (affichage) ================= */
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

const norm = (s: string) =>
  s.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** ================= Utils rendu ================= */
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

/** ================= Server Action : Générer programme (1/mois) ================= */
async function doAutogenAction(formData: FormData) {
  "use server";

  const c = cookies();
  const last = c.get("fc_autogen_at")?.value || "";
  const now = new Date();

  // Limite à 1/mois (30 jours glissants)
  if (last) {
    const lastDt = new Date(last);
    const diffMs = now.getTime() - lastDt.getTime();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    if (isFinite(diffMs) && diffMs < THIRTY_DAYS) {
      // déjà fait dans les 30j
      redirect("/dashboard/profile?error=Limite%201%20g%C3%A9n%C3%A9ration%20par%20mois.%20R%C3%A9essayez%20plus%20tard.");
    }
  }

  // email pour l'autogen : cookie app_email si dispo
  const email = c.get("app_email")?.value || "";
  // user id opaque pour Redis (si cookie fc_uid est posé, sinon "me")
  const user = c.get("fc_uid")?.value || "me";

  // Appelle l’API interne (qui remplit Redis si vide) — voir apps/web/app/api/programme/route.ts
  const qp = new URLSearchParams({ user, autogen: "1" });
  if (email) qp.set("email", email);
  const url = `${process.env.APP_BASE_URL || ""}/api/programme?${qp.toString()}` || `/api/programme?${qp.toString()}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      redirect("/dashboard/profile?error=%C3%89chec%20de%20la%20g%C3%A9n%C3%A9ration%20du%20programme.");
    }
    // pose le cookie de rate-limit (visible côté serveur) — 400 jours de durée
    c.set("fc_autogen_at", now.toISOString(), {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      // @ts-ignore — Next n'expose pas maxAge dans types cookies().set, mais fonctionne à l'exécution
      maxAge: 60 * 60 * 24 * 400,
    });
  } catch {
    redirect("/dashboard/profile?error=Serveur%20indisponible%20pour%20g%C3%A9n%C3%A9rer%20le%20programme.");
  }

  // rafraîchit la page
  revalidatePath("/dashboard/profile");
  redirect("/dashboard/profile?success=programme");
}

/** ================= Page (Server Component) ================= */
export default async function Page({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string; done?: string; deleted?: string };
}) {
  const c = cookies();

  // Store local (cookie) → séances passées
  const store = parseStore(c.get("app_sessions")?.value);
  const past = store.sessions
    .filter((s) => s.status === "done")
    .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""));

  // Infos client depuis questionnaire (affichage en-tête)
  const emailForLink = c.get("app_email")?.value || "";
  let clientPrenom = "",
    clientAge: number | undefined,
    clientEmailDisplay = emailForLink,
    goalLabel = "";

  try {
    if (emailForLink) {
      // On lit la dernière ligne correspondante et on construit le profil (afin d’afficher l’objectif)
      const ans = await getAnswersForEmail(emailForLink);
      if (ans) {
        const get = (k: string) => ans[norm(k)] || ans[k] || "";
        clientPrenom = get("prénom") || get("prenom") || "";
        const ageStr = get("age");
        const num = Number((ageStr || "").toString().replace(",", "."));
        clientAge = Number.isFinite(num) && num > 0 ? Math.floor(num) : undefined;
        const emailSheet = get("email") || get("adresse mail") || get("e-mail") || get("mail");
        if (!clientEmailDisplay && emailSheet) clientEmailDisplay = emailSheet;

        // Objectif actuel
        const profile = buildProfileFromAnswers(ans);
        const goalMap: Record<string, string> = {
          hypertrophy: "Hypertrophie / Esthétique",
          fatloss: "Perte de gras",
          strength: "Force",
          endurance: "Endurance / Cardio",
          mobility: "Mobilité / Souplesse",
          general: "Forme générale",
        };
        goalLabel = goalMap[profile.goal] || "Non défini";
      }
    }
  } catch {}

  // Propositions IA (utilise la même logique que la page séance)
  const programme = await getProgrammeForUser();
  const aiSessions: AiSessionT[] = programme?.sessions ?? [];

  // URL questionnaire pré-rempli
  const questionnaireUrl = (() => {
    const qp = new URLSearchParams();
    if (clientEmailDisplay) qp.set("email", clientEmailDisplay);
    if (clientPrenom) qp.set("prenom", clientPrenom);
    const qs = qp.toString();
    return qs ? `${QUESTIONNAIRE_BASE}?${qs}` : QUESTIONNAIRE_BASE;
  })();

  // Témoin rate-limit côté UI
  const lastAuto = c.get("fc_autogen_at")?.value || "";
  let rateLimitText = "";
  let canAutogen = true;
  if (lastAuto) {
    const lastDt = new Date(lastAuto);
    const diffMs = Date.now() - lastDt.getTime();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    if (isFinite(diffMs) && diffMs < THIRTY_DAYS) {
      canAutogen = false;
      const nextDate = new Date(lastDt.getTime() + THIRTY_DAYS);
      rateLimitText = `Tu pourras regénérer le ${nextDate.toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}.`;
    }
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
          <div
            className="card"
            style={{ border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", fontWeight: 600 }}
          >
            {displayedSuccess === "programme" ? "✓ Programme IA mis à jour." : "✓ Opération réussie."}
          </div>
        )}
        {!!searchParams?.done && (
          <div
            className="card"
            style={{ border: "1px solid rgba(59,130,246,.35)", background: "rgba(59,130,246,.08)", fontWeight: 600 }}
          >
            ✓ Séance terminée.
          </div>
        )}
        {!!searchParams?.deleted && (
          <div
            className="card"
            style={{ border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", fontWeight: 600 }}
          >
            Séance supprimée.
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

      {/* ===== Mes infos + Objectif actuel + actions ===== */}
      <section className="section" style={{ marginTop: 12 }}>
        <div
          className="section-head"
          style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
        >
          <h2>Mes infos</h2>

          {/* Bouton : Générer mon programme (1/mois) */}
          <form action={doAutogenAction}>
            <button
              type="submit"
              disabled={!canAutogen}
              className="btn"
              style={{
                background: canAutogen ? "#111827" : "#e5e7eb",
                color: canAutogen ? "#ffffff" : "#9ca3af",
                border: "1px solid #d1d5db",
                fontWeight: 600,
                padding: "6px 10px",
                lineHeight: 1.2,
                borderRadius: 8,
              }}
              title={canAutogen ? "Génère/Met à jour ton programme personnalisé" : "Limite 1 fois par mois"}
            >
              ⚙️ Générer mon programme
            </button>
          </form>
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
            style={{
              marginTop: 6,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
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

          {/* Rappel limite génération */}
          {!canAutogen && rateLimitText && (
            <div className="text-xs" style={{ marginTop: 8, color: "#92400e" }}>
              ⏳ {rateLimitText}
            </div>
          )}

          {/* Lien vers questionnaire */}
          <div className="text-sm" style={{ marginTop: 10 }}>
            <a href={questionnaireUrl} className="underline">
              Mettre à jour mes réponses au questionnaire
            </a>
          </div>
        </div>
      </section>

      {/* ===== Séances proposées (IA) ===== */}
      <section className="section" style={{ marginTop: 12 }}>
        <div
          className="section-head"
          style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
        >
          <div>
            <h2 style={{ marginBottom: 6 }}>Séances proposées</h2>
            <p className="text-sm" style={{ color: "#6b7280" }}>
              Personnalisées via l’analyse de vos réponses.
            </p>
          </div>
          <a href={questionnaireUrl} className="btn btn-dash">
            Je mets à jour
          </a>
        </div>

        {aiSessions.length === 0 ? (
          <div className="card text-sm" style={{ color: "#6b7280" }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted">🤖</span>
              <span>
                Pas encore de séances.{" "}
                <a className="link underline" href={questionnaireUrl}>
                  Remplissez le questionnaire
                </a>{" "}
                puis cliquez sur « Générer mon programme ».
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
                // Debug pratique côté page séance
                regen: "1",
                debug: "1",
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
                regen: "0",
                debug: "1",
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
