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
function ensureAtLeast4(list: NormalizedExercise[], type: WorkoutType, equip: "full" | "none") {
  const out = [...list];
  if (out.length >= 4) return uniqByName(out);
  const fb = genericFallback(type, equip).sort((a, b) => scoreExercise(b) - scoreExercise(a));
  for (const ex of fb) {
    if (out.length >= 4) break;
    if (equip === "none" && requiresEquipment(ex)) continue;
    out.push(ex);
  }
  return uniqByName(out).slice(0, 4);
}

/* ===== Helpers Supabase admin → programme_insights ===== */

async function getSupabaseAdmin() {
  // On accepte SUPABASE_URL ou, à défaut, NEXT_PUBLIC_SUPABASE_URL
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

    // Anti-doublon : si on a déjà une ligne très récente, on skip
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
async function loadInitialSessions(email: string, equipParam?: string) {
  if (!email) return [];
  const equip =
    String(equipParam || "") === "none"
      ? "none"
      : String(equipParam || "") === "full"
      ? "full"
      : "";

  try {
    if (equip === "none" || equip === "full") {
      const answers = await getAnswersForEmail(email, { fresh: true });
      if (!answers) return [];
      (answers as any).equipLevel = equip === "none" ? "none" : "full";
      const prog = generateProgrammeFromAnswers(answers);
      const sessions: AiSessionT[] = prog.sessions || [];

      // Applique ≥4 exos dans les deux modes
      const finalSessions = sessions.map((s) => {
        const type = (s.type || "muscu") as WorkoutType;
        let exs = (s.exercises || []).slice();
        if (equip === "none") {
          // stricte bodyweight
          exs = exs.filter((ex) => !requiresEquipment(ex));
        }
        const ensured = ensureAtLeast4(exs, type, equip);
        return { ...s, exercises: ensured };
      });

      // Log unique dans programme_insights
      await logProgrammeInsightToSupabase(email, answers, finalSessions);

      return finalSessions;
    }

    // Par défaut : logique existante (avec matériel), mais on sécurise ≥4 exos pour l'affichage
    const { sessions } = await planProgrammeFromEmail(email);
    const baseSessions: AiSessionT[] = sessions || [];
    const safe = baseSessions.map((s) => {
      const type = (s.type || "muscu") as WorkoutType;
      const ensured = ensureAtLeast4(s.exercises || [], type, "full");
      return { ...s, exercises: ensured };
    });

    // on recharge les réponses pour le log combiné (si dispo)
    let answersForLog: any = null;
    try {
      answersForLog = await getAnswersForEmail(email, { fresh: true });
    } catch {
      // silencieux
    }

    await logProgrammeInsightToSupabase(email, answersForLog, safe);

    return safe;
  } catch {
    return [];
  }
}

/* Utilitaires d’URL → listes (sans changer la logique de génération) */
function parseIdList(param?: string | string[]) {
  const raw = Array.isArray(param) ? param[0] : param || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}
function sessionKey(_s: AiSessionT, idx: number) {
  // clé stable "s{index}"
  return `s${idx}`;
}

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

  // Flag "générer" : on n'affiche la liste principale qu'après clic
  const hasGenerate =
    String(searchParams?.generate || "").toLowerCase() === "1";

  // Mode liste: '' (défaut = matériel), 'none' ou 'full'
  const equipParam = String(searchParams?.equip || "").toLowerCase();
  const equipMode: "full" | "none" = equipParam === "none" ? "none" : "full";

  // Liste : on NE génère que si hasGenerate = true
  const initialSessions = hasGenerate
    ? await loadInitialSessions(emailForDisplay, equipMode)
    : [];

  // Buckets depuis l’URL (aucune persistance serveur, aucune logique IA modifiée)
  const savedIds = parseIdList(searchParams?.saved);
  const laterIds = parseIdList(searchParams?.later);

  // Dérive les deux listes pour le bloc "Mes listes"
  const savedList = initialSessions
    .map((s, i) => ({ s, idx: i, key: sessionKey(s, i) }))
    .filter(({ key }) => savedIds.has(key));
  const laterList = initialSessions
    .map((s, i) => ({ s, idx: i, key: sessionKey(s, i) }))
    .filter(({ key }) => laterIds.has(key));

  const showPlaceholders = !forceBlank;

  const p = (profile ?? {}) as Partial<ProfileT>;
  const clientPrenom =
    typeof p?.prenom === "string" && p.prenom && !/\d/.test(p.prenom)
      ? p.prenom
      : "";
  const clientAge = typeof p?.age === "number" && p.age > 0 ? p.age : undefined;

  const goalLabel = (() => {
    const g = String(
      (p as any)?.objectif || (p as any)?.goal || ""
    ).toLowerCase();
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

  // Conserver saved/later quand on bascule de mode
  const qsKeep = [
    hasGenerate ? "generate=1" : undefined,
    savedIds.size ? `saved=${[...savedIds].join(",")}` : undefined,
    laterIds.size ? `later=${[...laterIds].join(",")}` : undefined,
  ]
    .filter(Boolean)
    .join("&");
  const hrefFull = `/dashboard/profile${qsKeep ? `?${qsKeep}` : ""}`;
  const hrefNone = `/dashboard/profile?equip=none${qsKeep ? `&${qsKeep}` : ""}`;

  const titleList =
    equipMode === "none" ? "Mes séances (sans matériel)" : "Mes séances";
  const hrefGenerate = `/dashboard/profile?generate=1${
    equipMode === "none" ? "&equip=none" : ""
  }${qsKeep ? `&${qsKeep}` : ""}`;

  // Base de query pour les liens vers les détails de séance (et pour garder les listes)
  const baseLinkQuery = [
    equipMode === "none" ? "equip=none" : undefined,
    "generate=1",
    savedIds.size ? `saved=${[...savedIds].join(",")}` : undefined,
    laterIds.size ? `later=${[...laterIds].join(",")}` : undefined,
  ]
    .filter(Boolean)
    .join("&");

  return (
    <div
      className="container"
      style={{
        paddingTop: 24,
        paddingBottom: 32,
        fontSize: "var(--settings-fs, 12px)",
      }}
    >
      <div className="page-header">
        <div>
          <h1 className="h1" style={{ fontSize: 22 }}>
            Mon profil
          </h1>
          {showDebug && (
            <div
              className="text-xs"
              style={{ marginTop: 4, color: "#6b7280" }}
            >
              <b>Debug:</b> email = <code>{emailForDisplay || "—"}</code>{" "}
              {debugInfo.sheetHit
                ? "· Sheet OK"
                : `· ${debugInfo.reason || "Sheet KO"}`}
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
            style={{
              border: "1px solid rgba(16,185,129,.35)",
              background: "rgba(16,185,129,.08)",
              fontWeight: 600,
            }}
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
          style={{
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h2>Mes infos</h2>
        </div>

        <div className="card">
          <div
            className="text-sm"
            style={{ display: "flex", gap: 16, flexWrap: "wrap" }}
          >
            {(clientPrenom || showPlaceholders) && (
              <span>
                <b>Prénom :</b>{" "}
                {clientPrenom ||
                  (showPlaceholders ? (
                    <i className="text-gray-400">Non renseigné</i>
                  ) : null)}
              </span>
            )}
            {(typeof clientAge === "number" || showPlaceholders) && (
              <span>
                <b>Âge :</b>{" "}
                {typeof clientAge === "number"
                  ? `${clientAge} ans`
                  : showPlaceholders
                  ? (
                    <i className="text-gray-400">Non renseigné</i>
                    )
                  : null}
              </span>
            )}
            {(goalLabel || showPlaceholders) && (
              <span>
                <b>Objectif actuel :</b>{" "}
                {goalLabel ||
                  (showPlaceholders ? (
                    <i className="text-gray-400">Non défini</i>
                  ) : null)}
              </span>
            )}
          </div>

          {(emailForDisplay || showPlaceholders) && (
            <div
              className="text-sm"
              style={{
                marginTop: 6,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
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

      {/* ===== Génération / Mes séances + bascule matériel/sans matériel ===== */}
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
          <h2 style={{ margin: 0 }}>{hasGenerate ? titleList : "Mes séances"}</h2>

          {hasGenerate && (
            <div
              className="inline-flex items-center"
              style={{ display: "inline-flex", gap: 8 }}
            >
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
          )}
        </div>

        {!hasGenerate && (
          <div
            className="card"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div className="text-sm" style={{ color: "#4b5563" }}>
              Cliquez sur « Générer » pour afficher vos séances personnalisées.
            </div>
            <a
              href={hrefGenerate}
              className="inline-flex items-center rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
              title="Générer mes séances"
            >
              Générer
            </a>
          </div>
        )}

        {hasGenerate && (
          <GenerateClient
            email={emailForDisplay}
            questionnaireBase={QUESTIONNAIRE_BASE}
            initialSessions={initialSessions}
            linkQuery={[
              equipMode === "none" ? "equip=none" : undefined,
              "generate=1",
              savedIds.size ? `saved=${[...savedIds].join(",")}` : undefined,
              laterIds.size ? `later=${[...laterIds].join(",")}` : undefined,
            ]
              .filter(Boolean)
              .join("&")}
          />
        )}
      </section>

      {/* ===== Bloc bas de page : Séance faite ✅ / À faire plus tard ⏳ ===== */}
      <section className="section" style={{ marginTop: 20 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Mes listes</h2>
        </div>

        {/* deux colonnes sur la même ligne */}
        <div
          className="grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          {/* Séance faite ✅ */}
          <div className="card">
            <div
              className="text-sm"
              style={{ fontWeight: 600, marginBottom: 6 }}
            >
              Séance faite <span aria-hidden>✅</span>
            </div>
            {savedList.length > 0 && (
              <ul
                className="text-sm"
                style={{ listStyle: "disc", paddingLeft: 18, margin: 0 }}
              >
                {savedList.map(({ s, idx, key }) => {
                  const detailHref = `/dashboard/seance/${encodeURIComponent(
                    s.id || key
                  )}${baseLinkQuery ? `?${baseLinkQuery}` : ""}`;

                  // URL qui supprime uniquement cette séance de la liste "saved"
                  const newSavedKeys = [...savedIds].filter((k) => k !== key);
                  const removeQuery = [
                    "generate=1",
                    equipMode === "none" ? "equip=none" : undefined,
                    newSavedKeys.length
                      ? `saved=${newSavedKeys.join(",")}`
                      : undefined,
                    laterIds.size
                      ? `later=${[...laterIds].join(",")}`
                      : undefined,
                  ]
                    .filter(Boolean)
                    .join("&");
                  const removeHref = `/dashboard/profile${
                    removeQuery ? `?${removeQuery}` : ""
                  }`;

                  return (
                    <li
                      key={key}
                      style={{
                        marginBottom: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <a
                        href={detailHref}
                        style={{
                          fontWeight: 600,
                          textDecoration: "underline",
                          textUnderlineOffset: 2,
                        }}
                      >
                        {s.title || `Séance ${idx + 1}`}
                        {s.type ? (
                          <span style={{ color: "#6b7280" }}> · {s.type}</span>
                        ) : null}
                      </a>
                      <a
                        href={removeHref}
                        aria-label="Supprimer cette séance"
                        className="text-xs"
                        style={{
                          fontSize: 12,
                          padding: "2px 4px",
                          borderRadius: 999,
                          border: "1px solid #e5e7eb",
                          color: "#6b7280",
                          lineHeight: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        🗑️
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
            {/* si vide: ne rien afficher */}
          </div>

          {/* À faire plus tard ⏳ */}
          <div className="card">
            <div
              className="text-sm"
              style={{ fontWeight: 600, marginBottom: 6 }}
            >
              À faire plus tard <span aria-hidden>⏳</span>
            </div>
            {laterList.length > 0 && (
              <ul
                className="text-sm"
                style={{ listStyle: "disc", paddingLeft: 18, margin: 0 }}
              >
                {laterList.map(({ s, idx, key }) => {
                  const detailHref = `/dashboard/seance/${encodeURIComponent(
                    s.id || key
                  )}${baseLinkQuery ? `?${baseLinkQuery}` : ""}`;

                  // URL qui supprime uniquement cette séance de la liste "later"
                  const newLaterKeys = [...laterIds].filter((k) => k !== key);
                  const removeQuery = [
                    "generate=1",
                    equipMode === "none" ? "equip=none" : undefined,
                    savedIds.size
                      ? `saved=${[...savedIds].join(",")}`
                      : undefined,
                    newLaterKeys.length
                      ? `later=${newLaterKeys.join(",")}`
                      : undefined,
                  ]
                    .filter(Boolean)
                    .join("&");
                  const removeHref = `/dashboard/profile${
                    removeQuery ? `?${removeQuery}` : ""
                  }`;

                  return (
                    <li
                      key={key}
                      style={{
                        marginBottom: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <a
                        href={detailHref}
                        style={{
                          fontWeight: 600,
                          textDecoration: "underline",
                          textUnderlineOffset: 2,
                        }}
                      >
                        {s.title || `Séance ${idx + 1}`}
                        {s.type ? (
                          <span style={{ color: "#6b7280" }}> · {s.type}</span>
                        ) : null}
                      </a>
                      <a
                        href={removeHref}
                        aria-label="Supprimer cette séance"
                        className="text-xs"
                        style={{
                          fontSize: 12,
                          padding: "2px 4px",
                          borderRadius: 999,
                          border: "1px solid #e5e7eb",
                          color: "#6b7280",
                          lineHeight: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        🗑️
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
            {/* si vide: ne rien afficher */}
          </div>
        </div>
      </section>
    </div>
  );
}
