// apps/web/app/dashboard/profile/page.tsx
import { cookies } from "next/headers";

import {
  getAnswersForEmail,
  buildProfileFromAnswers,
  type Profile as ProfileT,
  type AiSession as AiSessionT,
  type NormalizedExercise,
  type WorkoutType,
} from "../../../lib/coach/ai";

import { planProgrammeFromEmail } from "../../../lib/coach/beton";
import ProfileClient from "./ProfileClient";

const QUESTIONNAIRE_BASE =
  process.env.FILES_COACHING_QUESTIONNAIRE_BASE ||
  "https://questionnaire.files-coaching.com";

// 🔒 Route serveur qui génère l’URL signée et redirige
const QUESTIONNAIRE_LINK = "/api/questionnaire-link";

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

/* ===== Helpers bodyweight / backfill (≥ 4 exos) ===== */
function requiresEquipmentName(s: string): boolean {
  const t = s.toLowerCase();
  return /halt[eè]re|dumbbell|barre|barbell|kettlebell|kettle|machine|poulie|c(?:â|a)ble|smith|presse|leg\s*press|bench\b|banc|box jump|box\b|step(?:per)?|[ée]lastique|band|trx|sangle|anneaux|rings?|med(?:ecine)?\s*ball|ballon|bosu|ab\s*wheel|roue\s*abdo|rameur|rower|erg|assault\s*bike|v[ée]lo|tapis|pull-?up|tractions?|dips?|barre\s*fixe|chaise|table/i.test(
    t
  );
}
function requiresEquipment(ex: NormalizedExercise): boolean {
  return requiresEquipmentName(`${ex.name || ""} ${ex.notes || ""}`);
}
function genericFallback(
  type: WorkoutType,
  equip: "full" | "none"
): NormalizedExercise[] {
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
      {
        name: "Respiration diaphragmatique",
        reps: "2–3 min",
        block: "echauffement",
      },
      { name: "90/90 hanches", reps: "8–10/ côté", block: "principal" },
      { name: "T-spine rotations", reps: "8–10/ côté", block: "principal" },
      { name: "Down-Dog → Cobra", reps: "6–8", block: "fin" },
    ];
  }
  if (equip === "none") {
    return [
      {
        name: "Squat au poids du corps",
        sets: 3,
        reps: "12–15",
        rest: "60–75s",
        block: "principal",
      },
      {
        name: "Pompes",
        sets: 3,
        reps: "8–15",
        rest: "60–75s",
        block: "principal",
      },
      {
        name: "Fentes alternées",
        sets: 3,
        reps: "10–12/ côté",
        rest: "60–75s",
        block: "principal",
      },
      {
        name: "Planche",
        sets: 2,
        reps: "30–45s",
        rest: "45s",
        block: "fin",
      },
    ];
  }
  return [
    {
      name: "Goblet Squat",
      sets: 3,
      reps: "8–12",
      rest: "75s",
      block: "principal",
    },
    {
      name: "Développé haltères",
      sets: 3,
      reps: "8–12",
      rest: "75s",
      block: "principal",
    },
    {
      name: "Rowing unilatéral",
      sets: 3,
      reps: "10–12/ côté",
      rest: "75s",
      block: "principal",
    },
    {
      name: "Planche",
      sets: 2,
      reps: "30–45s",
      rest: "45s",
      block: "fin",
    },
  ];
}
function uniqByName(list: NormalizedExercise[]): NormalizedExercise[] {
  const seen = new Set<string>();
  return list.filter((ex) => {
    const k = (ex.name || "").trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function scoreExercise(ex: NormalizedExercise): number {
  let s = 0;
  if ((ex.block || "").toLowerCase() === "principal") s += 3;
  if (
    /(squat|fente|deadlift|soulev[ée] de terre|row|tirage|pull(?:-?up)?|traction|d[ée]velopp[ée]|press|hip|glute)/i.test(
      (ex.name || "").toLowerCase()
    )
  )
    s += 2;
  if (ex.sets && ex.reps) s += 1;
  return s;
}
function ensureAtLeast4(
  list: NormalizedExercise[],
  type: WorkoutType,
  equip: "full" | "none"
) {
  const out = [...list];
  if (out.length >= 4) return uniqByName(out);
  const fb = genericFallback(type, equip).sort(
    (a, b) => scoreExercise(b) - scoreExercise(a)
  );
  for (const ex of fb) {
    if (out.length >= 4) break;
    if (equip === "none" && requiresEquipment(ex)) continue;
    out.push(ex);
  }
  return uniqByName(out).slice(0, 4);
}

/* ===== Helpers Supabase admin → programme_insights & programme_lists ===== */
async function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceKey) {
    console.error(
      "[programme_insights] Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
    return null;
  }

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, serviceKey);
}

async function findUserIdByEmail(
  supabaseAdmin: any,
  email: string
): Promise<string | null> {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", normalized)
      .single();

    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

/**
 * Log unique dans programme_insights :
 * 1 ligne = 1 génération de programme pour un client
 * (réponses + toutes les séances)
 * + anti-doublon (si même mail + questionnaire dans les 10s)
 */
async function logProgrammeInsightToSupabase(
  email: string,
  answers: any,
  sessions: AiSessionT[]
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();
    if (!supabaseAdmin || !sessions || !sessions.length) return;

    const normalizedEmail = (email || "").trim().toLowerCase();
    const questionnaireKey = "onboarding_v1";

    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("programme_insights")
      .select("id")
      .eq("email", normalizedEmail)
      .eq("questionnaire_key", questionnaireKey)
      .gte("created_at", tenSecondsAgo)
      .limit(1);

    if (!existingErr && existing && existing.length) {
      return;
    }

    const userId = await findUserIdByEmail(supabaseAdmin, normalizedEmail);

    await supabaseAdmin.from("programme_insights").insert({
      user_id: userId,
      email: normalizedEmail || null,
      questionnaire_key: questionnaireKey,
      answers: answers || null,
      sessions: sessions as any,
    });
  } catch (e) {
    console.error("[logProgrammeInsightToSupabase] error:", e);
  }
}

/* ===== Helpers Supabase → programme_lists (listes faite / plus tard) ===== */

type ProgrammeLists = {
  savedIds: string[];
  laterIds: string[];
};

async function loadListsFromSupabase(email: string): Promise<ProgrammeLists> {
  try {
    const supabaseAdmin = await getSupabaseAdmin();
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!supabaseAdmin || !normalizedEmail) {
      return { savedIds: [], laterIds: [] };
    }

    const { data, error } = await supabaseAdmin
      .from("programme_lists")
      .select("saved_ids,later_ids")
      .eq("email", normalizedEmail)
      .single();

    if (error || !data) {
      return { savedIds: [], laterIds: [] };
    }

    return {
      savedIds: (data.saved_ids as string[] | null) || [],
      laterIds: (data.later_ids as string[] | null) || [],
    };
  } catch (e) {
    console.error("[loadListsFromSupabase] error:", e);
    return { savedIds: [], laterIds: [] };
  }
}

async function saveListsToSupabase(
  email: string,
  savedIds: string[],
  laterIds: string[]
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!supabaseAdmin || !normalizedEmail) return;

    await supabaseAdmin
      .from("programme_lists")
      .upsert(
        {
          email: normalizedEmail,
          saved_ids: savedIds,
          later_ids: laterIds,
        },
        { onConflict: "email" }
      );
  } catch (e) {
    console.error("[saveListsToSupabase] error:", e);
  }
}

/* Loaders — Mes infos */
async function loadProfile(
  searchParams?: Record<string, string | string[] | undefined>
) {
  const forceBlank = ["1", "true", "yes"].includes(
    String(searchParams?.blank || searchParams?.empty || "").toLowerCase()
  );

  const cookieEmail = (cookies().get("app_email")?.value || "")
    .trim()
    .toLowerCase();
  const sessionEmail = cookieEmail || (await getEmailFromSupabaseSession());
  const emailForDisplay = sessionEmail;

  if (forceBlank) {
    return {
      emailForDisplay: "",
      profile: {} as Partial<ProfileT>,
      debugInfo: {
        email: emailForDisplay || "",
        sheetHit: false,
        reason: "Force blank via ?blank=1",
      },
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
/**
 * forceNew = true  → on force une nouvelle génération via l'IA
 * forceNew = false → on essaie d'abord de reprendre le dernier programme
 *                    depuis programme_insights. Si rien n'existe, on génère.
 */
async function loadInitialSessions(
  email: string,
  equipParam?: string,
  forceNew?: boolean
) {
  if (!email) return [];
  const equip: "full" | "none" =
    String(equipParam || "").toLowerCase() === "none" ? "none" : "full";

  // 🔤 Détection de la langue à partir du cookie NEXT_LOCALE
  const locale = cookies().get("NEXT_LOCALE")?.value;
  const lang: "fr" | "en" = locale === "en" ? "en" : "fr";

  try {
    let baseSessions: AiSessionT[] = [];

    const supabaseAdmin = await getSupabaseAdmin();

    // 1) On tente d'abord de récupérer le DERNIER programme déjà généré,
    //    sauf si on force explicitement une nouvelle génération.
    if (supabaseAdmin && !forceNew) {
      const normalizedEmail = (email || "").trim().toLowerCase();
      try {
        const { data, error } = await supabaseAdmin
          .from("programme_insights")
          .select("sessions")
          .eq("email", normalizedEmail)
          .eq("questionnaire_key", "onboarding_v1")
          .order("created_at", { ascending: false })
          .limit(1);

        if (!error && data && data.length && data[0]?.sessions) {
          baseSessions = data[0].sessions as AiSessionT[];
        }
      } catch {
        // si erreur, on tombera sur la régénération plus bas
      }
    }

    // 2) Si aucun programme trouvé, ou si forceNew = true, on génère via l’IA
    if (!baseSessions.length) {
      const { sessions } = await planProgrammeFromEmail(email, { lang });
      baseSessions = sessions || [];
      await logProgrammeInsightToSupabase(email, null, baseSessions);
    }

    // 3) Post-traitement existant (équipement, au moins 4 exos, etc.)
    const finalSessions = baseSessions.map((s) => {
      const type = (s.type || "muscu") as WorkoutType;
      let exs = (s.exercises || []).slice();
      if (equip === "none") {
        exs = exs.filter((ex) => !requiresEquipment(ex));
      }
      exs = ensureAtLeast4(exs, type, equip);
      return { ...s, exercises: exs };
    });

    // log (ça doublonne un peu mais on garde ta logique)
    await logProgrammeInsightToSupabase(email, null, finalSessions);

    return finalSessions;
  } catch {
    return [];
  }
}

/* Utilitaires d’URL → listes */
function parseIdList(param?: string | string[]) {
  const raw = Array.isArray(param) ? param[0] : param || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page({
  searchParams,
}: {
  searchParams?: {
    success?: string;
    error?: string;
    debug?: string;
    blank?: string;
    empty?: string;
    equip?: string;
    generate?: string;
    saved?: string;
    later?: string;
  };
}) {
  const { emailForDisplay, profile, debugInfo, forceBlank } =
    await loadProfile(searchParams);

  // flag dans l'URL : ?generate=1 → on force une nouvelle génération
  const generateParam =
    String(searchParams?.generate || "").toLowerCase() === "1";

  const equipParam = String(searchParams?.equip || "").toLowerCase();
  const equipMode: "full" | "none" = equipParam === "none" ? "none" : "full";

  // On charge TOUJOURS les séances :
  // - si generateParam = true → on force une nouvelle génération
  // - sinon → on essaie d'abord de reprendre le dernier programme existant
  const initialSessions = await loadInitialSessions(
    emailForDisplay,
    equipMode,
    generateParam
  );

  // hasGenerate = est-ce qu'on a un programme à afficher ?
  const hasGenerate = initialSessions.length > 0;

  // 🔁 Listes "faite / plus tard"
  // 1) On charge ce qui est déjà en BDD
  const dbLists = await loadListsFromSupabase(emailForDisplay);

  // 2) On regarde si l'URL fournit une version à jour (clic sur 🗑️ / ajout)
  const querySavedSet = parseIdList(searchParams?.saved);
  const queryLaterSet = parseIdList(searchParams?.later);

  const hasSavedParam = typeof searchParams?.saved !== "undefined";
  const hasLaterParam = typeof searchParams?.later !== "undefined";

  // 3) Si des paramètres sont présents, ils sont la source de vérité,
  //    sinon on tombe back sur ce qu'il y a en BDD.
  const savedIds = hasSavedParam
    ? [...querySavedSet]
    : dbLists.savedIds || [];
  const laterIds = hasLaterParam
    ? [...queryLaterSet]
    : dbLists.laterIds || [];

  // 4) On persiste la version finale en BDD (email + listes)
  await saveListsToSupabase(emailForDisplay, savedIds, laterIds);

  const displayedError = searchParams?.error || "";
  const displayedSuccess = searchParams?.success || "";
  const showDebug = String(searchParams?.debug || "") === "1";

  const p = (profile ?? {}) as Partial<ProfileT>;
  const clientPrenom =
    typeof p?.prenom === "string" && p.prenom && !/\d/.test(p.prenom)
      ? p.prenom
      : "";

  const questionnaireUrl = (() => {
    const qp = new URLSearchParams();
    if (emailForDisplay) qp.set("email", emailForDisplay);
    if (clientPrenom) qp.set("prenom", clientPrenom);
    const qs = qp.toString();
    return qs ? `${QUESTIONNAIRE_LINK}?${qs}` : QUESTIONNAIRE_LINK;
  })();

  return (
    <ProfileClient
      emailForDisplay={emailForDisplay}
      profile={profile}
      debugInfo={debugInfo}
      forceBlank={forceBlank}
      hasGenerate={hasGenerate}
      equipMode={equipMode}
      initialSessions={initialSessions}
      savedIds={savedIds}
      laterIds={laterIds}
      displayedError={displayedError}
      displayedSuccess={displayedSuccess}
      showDebug={showDebug}
      questionnaireUrl={questionnaireUrl}
      questionnaireBase={QUESTIONNAIRE_BASE}
    />
  );
}

