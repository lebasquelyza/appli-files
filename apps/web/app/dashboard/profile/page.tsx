// apps/web/app/dashboard/profile/page.tsx
import { cookies } from "next/headers";

import {
  getAnswersForEmail,
  buildProfileFromAnswers,
  generateProgrammeFromAnswers,
  type Profile as ProfileT,
  type AiSession as AiSessionT,
  type NormalizedExercise,
  type WorkoutType,
} from "../../../lib/coach/ai";

import { planProgrammeFromEmail } from "../../../lib/coach/beton";
import GenerateClient from "./GenerateClient";

const QUESTIONNAIRE_BASE =
  process.env.FILES_COACHING_QUESTIONNAIRE_BASE || "https://questionnaire.files-coaching.com";

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email?.trim().toLowerCase() || "";
  } catch {
    return "";
  }
}

/* ===== Helpers bodyweight ===== */
function requiresEquipmentName(s: string): boolean {
  const t = s.toLowerCase();
  return /(halt[eè]re|dumbbell|barre|barbell|kettlebell|kettle|machine|poulie|c(â|a)ble|smith|presse|leg press|bench\b|banc|[ée]lastique|band|trx|sangle|med(?:ecine)? ball|ballon|bosu|roue abdo|wheel|rameur|rower|v[ée]lo|assault bike|tapis|stepper|erg)/i.test(
    t
  );
}
function requiresEquipment(ex: NormalizedExercise): boolean {
  return requiresEquipmentName(`${ex.name || ""} ${ex.notes || ""}`);
}
function isUpper(ex: NormalizedExercise): boolean {
  const t = `${ex.name || ""} ${ex.target || ""}`.toLowerCase();
  return /(d[ée]velopp[ée]|bench|pec|chest|row|tirage|pull(?:-?up)?|traction|dos|back|[ée]paul|shoulder|delts?|biceps?|triceps?|curl|extension triceps)/i.test(
    t
  );
}
function isLower(ex: NormalizedExercise): boolean {
  const t = `${ex.name || ""} ${ex.target || ""}`.toLowerCase();
  return /(squat|fente|deadlift|soulev[ée] de terre|hip|glute|fess|ischio|quad|quads|quadriceps|hamstring|mollet|calf|leg(?!\s*raise))/i.test(
    t
  );
}
function isCoreOrNeutral(ex: NormalizedExercise): boolean {
  const t = `${ex.name || ""} ${ex.target || ""}`.toLowerCase();
  return /(gainage|planche|plank|abdo|core|hollow|dead bug|oiseau|bird dog|good morning|pont|bridge|mobilit[eé]|respiration)/i.test(
    t
  );
}
function genericFallback(type: WorkoutType, equip: "full" | "none"): NormalizedExercise[] {
  if (type === "cardio") {
    return [
      { name: "Échauffement Z1", reps: "8–10 min", block: "echauffement" },
      { name: "Cardio continu Z2", reps: "25–35 min", block: "principal" },
      { name: "Retour au calme + mobilité", reps: "5–8 min", block: "fin" },
      { name: "Marche progressive Z1→Z2", reps: "10–15 min", block: "fin" },
    ];
  }
  if (type === "mobilité") {
    return [
      { name: "Respiration diaphragmatique", reps: "2–3 min", block: "echauffement" },
      { name: "90/90 hanches", reps: "8–10/ côté", block: "principal" },
      { name: "T-spine rotations", reps: "8–10/ côté", block: "principal" },
      { name: "Down-Dog → Cobra", reps: "6–8", block: "fin" },
    ];
  }
  if (equip === "none") {
    return [
      { name: "Squat au poids du corps", sets: 3, reps: "12–15", rest: "60–75s", block: "principal" },
      { name: "Pompes", sets: 3, reps: "8–15", rest: "60–75s", block: "principal" },
      { name: "Fentes alternées", sets: 3, reps: "10–12/ côté", rest: "60–75s", block: "principal" },
      { name: "Planche", sets: 2, reps: "30–45s", rest: "45s", block: "fin" },
    ];
  }
  return [
    { name: "Goblet Squat", sets: 3, reps: "8–12", rest: "75s", block: "principal" },
    { name: "Développé haltères", sets: 3, reps: "8–12", rest: "75s", block: "principal" },
    { name: "Rowing unilatéral", sets: 3, reps: "10–12/ côté", rest: "75s", block: "principal" },
    { name: "Planche", sets: 2, reps: "30–45s", rest: "45s", block: "fin" },
  ];
}
function scoreExercise(ex: NormalizedExercise): number {
  let s = 0;
  if ((ex.block || "").toLowerCase() === "principal") s += 3;
  if (/(squat|fente|deadlift|soulev[ée] de terre|row|tirage|pull(?:-?up)?|traction|d[ée]velopp[ée]|press|hip|glute)/i.test((ex.name || "").toLowerCase())) s += 2;
  if (ex.sets && ex.reps) s += 1;
  return s;
}
function uniqByName(list: NormalizedExercise[]) {
  const seen = new Set<string>();
  return list.filter((ex) => {
    const k = (ex.name || "").trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function ensureAtLeast4(list: NormalizedExercise[], type: WorkoutType, equip: "full" | "none") {
  const out = [...list];
  if (out.length >= 4) return uniqByName(out);
  const fb = genericFallback(type, equip);
  fb.sort((a, b) => scoreExercise(b) - scoreExercise(a));
  for (const ex of fb) {
    if (out.length >= 4) break;
    out.push(ex);
  }
  return uniqByName(out).slice(0, 4);
}

/* Loaders — Mes infos */
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
    const answers = await getAnswersForEmail(emailForDisplay, { fresh: true });
    if (answers) {
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

/* Loader — Programme IA côté serveur (liste) */
async function loadInitialSessions(email: string, equipParam?: string) {
  if (!email) return [];
  const equip = (String(equipParam || "") === "none") ? "none" : (String(equipParam || "") === "full" ? "full" : "");

  try {
    if (equip === "none" || equip === "full") {
      const answers = await getAnswersForEmail(email, { fresh: true });
      if (!answers) return [];
      (answers as any).equipLevel = equip === "none" ? "none" : "full";
      const prog = generateProgrammeFromAnswers(answers);
      const sessions: AiSessionT[] = prog.sessions || [];

      // ⬇️ Nettoyage “strict bodyweight” pour la variante sans matériel
      if (equip === "none") {
        return sessions.map((s) => {
          const type = (s.type || "muscu") as WorkoutType;
          const exs = (s.exercises || []).filter((ex) => !requiresEquipment(ex));
          const ensured = ensureAtLeast4(exs, type, "none");
          return { ...s, exercises: ensured };
        });
      }
      return sessions;
    }

    // Par défaut : logique existante (avec matériel)
    const { sessions } = await planProgrammeFromEmail(email);
    return sessions || [];
  } catch {
    return [];
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string; debug?: string; blank?: string; empty?: string; equip?: string };
}) {
  const { emailForDisplay, profile, debugInfo, forceBlank } = await loadProfile(searchParams);

  // Mode liste: '' (défaut = matériel), 'none' ou 'full'
  const equipParam = String(searchParams?.equip || "").toLowerCase();
  const equipMode: "full" | "none" = equipParam === "none" ? "none" : "full";

  // Liste calculée selon l'équipement (avec filtre bodyweight si none)
  const initialSessions = await loadInitialSessions(emailForDisplay, equipMode);

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

  // Liens de bascule liste matériel / sans matériel
  const hrefFull = `/dashboard/profile`; // par défaut (avec matériel)
  const hrefNone = `/dashboard/profile?equip=none`; // liste sans matériel

  const titleList = equipMode === "none" ? "Mes séances (sans matériel)" : "Mes séances";

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
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {!!displayedSuccess && (
          <div
            className="card"
            style={{ border: "1px solid rgba(16,185,129,.35)", background: "rgba(16,185,129,.08)", fontWeight: 600 }}
          >
            {displayedSuccess === "programme"
              ? "✓ Programme IA mis à jour à partir de vos dernières réponses au questionnaire."
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
            {(clientPrenom || showPlaceholders) && (
              <span>
                <b>Prénom :</b>{" "}
                {clientPrenom || (showPlaceholders ? <i className="text-gray-400">Non renseigné</i> : null)}
              </span>
            )}
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
            {(goalLabel || showPlaceholders) && (
              <span>
                <b>Objectif actuel :</b>{" "}
                {goalLabel || (showPlaceholders ? <i className="text-gray-400">Non défini</i> : null)}
              </span>
            )}
          </div>

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

      {/* ===== Mes séances + bascule matériel/sans matériel ===== */}
      <section className="section" style={{ marginTop: 16 }}>
        <div
          className="section-head"
          style={{
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0 }}>{titleList}</h2>

          <div className="inline-flex items-center" style={{ display: "inline-flex", gap: 8 }}>
            <a
              href={hrefFull}
              className={
                equipMode === "full"
                  ? "inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white"
                  : "inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900"
              }
              title="Voir la liste avec matériel"
            >
              Matériel
            </a>
            <a
              href={hrefNone}
              className={
                equipMode === "none"
                  ? "inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white"
                  : "inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900"
              }
              title="Voir la liste sans matériel"
            >
              Sans matériel
            </a>
          </div>
        </div>

        {/* Le composant existant affiche la liste (inchangé) */}
        <GenerateClient
          email={emailForDisplay}
          questionnaireBase={QUESTIONNAIRE_BASE}
          initialSessions={initialSessions}
          // 👉 ajoute ce param aux liens de séance (voir patch GenerateClient ci-dessous)
          linkQuery={equipMode === "none" ? "equip=none" : undefined}
        />
      </section>
    </div>
  );
}

