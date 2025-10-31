// apps/web/app/dashboard/profile/page.tsx
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  getAnswersForEmail,
  buildProfileFromAnswers,
  type AiSession as AiSessionT,
  type Profile as ProfileT,
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
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email?.trim().toLowerCase() || "";
  } catch {
    return "";
  }
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

/* Loader — Programme IA côté serveur (SSR) */
async function loadInitialSessions(email: string) {
  if (!email) return [];
  try {
    const { sessions } = await planProgrammeFromEmail(email);
    return sessions || [];
  } catch {
    return [];
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string; debug?: string; blank?: string; empty?: string };
}) {
  const { emailForDisplay, profile, debugInfo, forceBlank } = await loadProfile(searchParams);

  const initialSessions = await loadInitialSessions(emailForDisplay);
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

      {/* ===== Mon programme ===== */}
      <GenerateClient
        email={emailForDisplay}
        questionnaireBase={QUESTIONNAIRE_BASE}
        initialSessions={initialSessions}
      />
    </div>
  );
}
