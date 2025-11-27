// apps/web/app/dashboard/profile/page.tsx
import { cookies } from "next/headers";
import ProfileClient from "./ProfileClient";
import { getProfileData } from "../../../lib/coach/profile";
import { getAiSessions } from "../../../lib/coach/ai";
import { getSavedLists } from "../../../lib/coach/lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getLang(): "fr" | "en" {
  const cookieLang = cookies().get("fc-lang")?.value;
  return cookieLang === "en" ? "en" : "fr";
}

export default async function Page() {
  const lang = getLang();

  // 🔥 Récupération des données serveur
  const profile = await getProfileData();
  const {
    sessions,
    hasGenerate,
    equipMode,
    displayedError,
    displayedSuccess,
    questionnaireUrl,
    questionnaireBase,
    debugInfo,
    forceBlank,
  } = await getAiSessions();

  const { savedIds, laterIds } = await getSavedLists();

  return (
    <ProfileClient
      lang={lang}
      emailForDisplay={profile?.email ?? ""}
      profile={profile}
      debugInfo={debugInfo}
      forceBlank={forceBlank}
      hasGenerate={hasGenerate}
      equipMode={equipMode}
      initialSessions={sessions}
      savedIds={savedIds}
      laterIds={laterIds}
      displayedError={displayedError}
      displayedSuccess={displayedSuccess}
      showDebug={process.env.NODE_ENV !== "production"}
      questionnaireUrl={questionnaireUrl}
      questionnaireBase={questionnaireBase}
    />
  );
}
