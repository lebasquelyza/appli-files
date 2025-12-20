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

/* ✅ NEW: start programme based on answers weekday or tomorrow */
const TZ = "Europe/Paris";
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Mon..Sun

function weekdayIndexInTZ(date: Date, tz = TZ): Weekday {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(date);

  const map: Record<string, Weekday> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[wd] ?? 0;
}

function getTomorrowWeekdayIndexInTZ(tz = TZ): Weekday {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return weekdayIndexInTZ(d, tz);
}

function rotateSessionsToStartFromIndex<T>(sessions: T[], startIndex: number): T[] {
  const n = sessions.length;
  if (n <= 1) return sessions;
  const start = ((startIndex % n) + n) % n;
  if (start === 0) return sessions;
  return [...sessions.slice(start), ...sessions.slice(0, start)];
}

/**
 * Détecte un jour explicitement choisi dans les réponses (FR/EN),
 * en cherchant lundi/mardi/... ou monday/tuesday/... dans toutes les strings.
 * Retourne 0..6 (Mon..Sun) ou null si aucun jour trouvé.
 */
function inferPreferredWeekdayFromAnswers(raw: any): Weekday | null {
  if (!raw || typeof raw !== "object") return null;

  const frEnMap: Array<[RegExp, Weekday]> = [
    [/\b(lundi|monday)\b/i, 0],
    [/\b(mardi|tuesday)\b/i, 1],
    [/\b(mercredi|wednesday)\b/i, 2],
    [/\b(jeudi|thursday)\b/i, 3],
    [/\b(vendredi|friday)\b/i, 4],
    [/\b(samedi|saturday)\b/i, 5],
    [/\b(dimanche|sunday)\b/i, 6],
  ];

  const stack: any[] = [raw];
  const seen = new Set<any>();

  while (stack.length) {
    const cur = stack.pop();
    if (!cur || seen.has(cur)) continue;
    seen.add(cur);

    if (typeof cur === "string") {
      const s = cur.toLowerCase();
      for (const [re, idx] of frEnMap) {
        if (re.test(s)) return idx;
      }
      continue;
    }

    if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v);
      continue;
    }

    if (typeof cur === "object") {
      for (const v of Object.values(cur)) stack.push(v);
    }
  }

  return null;
}

/**
 * Règle demandée :
 * - si jour explicite dans answers => on commence ce jour-là
 * - sinon => on commence demain
 */
function getStartIndexFromAnswersOrTomorrow(rawAnswers: any, tz = TZ): Weekday {
  const preferred = inferPreferredWeekdayFromAnswers(rawAnswers);
  if (preferred !== null) return preferred;
  return getTomorrowWeekdayIndexInTZ(tz);
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

/* ===== Normalisation des réponses pour comparaison (séances) ===== */
function normalizeAnswersForComparison(raw: any) {
  if (!raw || typeof raw !== "object") return raw;

  const {
    meta,
    metadata,
    _meta,
    synced_at,
    syncedAt,
    created_at,
    createdAt,
    updated_at,
    updatedAt,
    fetched_at,
    fetchedAt,
    ...rest
  } = raw as any;

  return rest;
}

/* Loader — Programme IA côté serveur (liste) */
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
    const supabaseAdmin = await getSupabaseAdmin();
    const normalizedEmail = (email || "").trim().toLowerCase();

    let baseSessions: AiSessionT[] = [];
    let lastInsight: { sessions: AiSessionT[]; answers: any } | null = null;

    // 1) On récupère le dernier programme existant (s'il existe)
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from("programme_insights")
          .select("sessions, answers")
          .eq("email", normalizedEmail)
          .eq("questionnaire_key", "onboarding_v1")
          .order("created_at", { ascending: false })
          .limit(1);

        if (!error && data && data.length) {
          const row = data[0] as any;
          lastInsight = row;
          baseSessions = (row.sessions || []) as AiSessionT[];
        }
      } catch {
        // si erreur, on tentera une génération
      }
    }

    // 2) Décider si on doit régénérer
    let mustRegenerate = false;

    if (!lastInsight) {
      mustRegenerate = true;
    }

    let currentAnswers: any = null;
    if (forceNew) {
      try {
        currentAnswers = await getAnswersForEmail(email, { fresh: true });
      } catch {
        currentAnswers = null;
      }

      if (lastInsight && currentAnswers) {
        const lastNorm = normalizeAnswersForComparison(lastInsight.answers);
        const currentNorm = normalizeAnswersForComparison(currentAnswers);

        const answersChanged =
          JSON.stringify(lastNorm ?? {}) !== JSON.stringify(currentNorm ?? {});

        if (answersChanged) {
          mustRegenerate = true;
        }
      }
    }

    // 3) Génération si nécessaire
    if (mustRegenerate) {
      // ✅ NEW: on veut les answers si possible AVANT de choisir le jour de départ
      if (!currentAnswers) {
        try {
          currentAnswers = await getAnswersForEmail(email, { fresh: true });
        } catch {
          currentAnswers = null;
        }
      }

      const { sessions } = await planProgrammeFromEmail(email, { lang });

      // ✅ NEW: start day logic:
      // - jour explicite dans réponses => commencer ce jour-là
      // - sinon => commencer demain
      const startIndex = getStartIndexFromAnswersOrTomorrow(currentAnswers, TZ);
      baseSessions = rotateSessionsToStartFromIndex(sessions || [], startIndex);

      await logProgrammeInsightToSupabase(email, currentAnswers, baseSessions);
    }

    if (!baseSessions || !baseSessions.length) {
      return [];
    }

    // 4) Post-traitement existant (équipement, au moins 4 exos, etc.)
    const finalSessions = baseSessions.map((s) => {
      const type = (s.type || "muscu") as WorkoutType;
      let exs = (s.exercises || []).slice();
      if (equip === "none") {
        exs = exs.filter((ex) => !requiresEquipment(ex));
      }
      exs = ensureAtLeast4(exs, type, equip);
      return { ...s, exercises: exs };
    });

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

  // flag dans l'URL : ?generate=1 → le client a cliqué sur "Régénérer"
  const generateParam =
    String(searchParams?.generate || "").toLowerCase() === "1";

  const equipParam = String(searchParams?.equip || "").toLowerCase();
  const equipMode: "full" | "none" = equipParam === "none" ? "none" : "full";

  const initialSessions = await loadInitialSessions(
    emailForDisplay,
    equipMode,
    generateParam
  );

  const hasGenerate = initialSessions.length > 0;

  const dbLists = await loadListsFromSupabase(emailForDisplay);

  const querySavedSet = parseIdList(searchParams?.saved);
  const queryLaterSet = parseIdList(searchParams?.later);

  const hasSavedParam = typeof searchParams?.saved !== "undefined";
  const hasLaterParam = typeof searchParams?.later !== "undefined";

  const savedIds = hasSavedParam ? [...querySavedSet] : dbLists.savedIds || [];
  const laterIds = hasLaterParam ? [...queryLaterSet] : dbLists.laterIds || [];

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
      /* 👇 NOUVELLE PROP : permet à ProfileClient de savoir qu'on vient de cliquer sur "Générer" */
      showAdOnGenerate={generateParam}
    />
  );
}
