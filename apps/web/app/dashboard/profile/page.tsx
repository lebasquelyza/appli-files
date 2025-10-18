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

const QUESTIONNAIRE_BASE = "https://questionnaire.files-coaching.com";

/* ============ Types ============ */
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

function parseStore(val?: string | null): Store {
  if (!val) return { sessions: [] };
  try {
    const o = JSON.parse(val!);
    if (Array.isArray(o?.sessions)) return { sessions: o.sessions as Workout[] };
  } catch {}
  return { sessions: [] };
}

function getBaseUrlFromHeaders() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/* ============ Génération programme (server action) ============ */
async function doAutogenAction(formData: FormData) {
  "use server";
  const c = cookies();
  const user = c.get("fc_uid")?.value || "me";
  const email = c.get("app_email")?.value || "";
  const qp = new URLSearchParams({ user, autogen: "1" });
  if (email) qp.set("email", email);
  const url = `${getBaseUrlFromHeaders()}/api/programme?${qp.toString()}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      redirect(`/dashboard/profile?error=Erreur lors de la génération`);
    }
  } catch (e) {
    redirect(`/dashboard/profile?error=Serveur indisponible`);
  }

  revalidatePath("/dashboard/profile");
  redirect("/dashboard/profile?success=programme");
}

/* ============ Fetch API ============ */
type ProgrammeFromApi = { sessions: AiSessionT[]; profile?: Partial<ProfileT> };

async function fetchProgrammeFromApi(email?: string): Promise<ProgrammeFromApi | null> {
  const c = cookies();
  const user = c.get("fc_uid")?.value || "me";
  const qp = new URLSearchParams({ user });
  if (email) qp.set("email", email);
  const url = `${getBaseUrlFromHeaders()}/api/programme?${qp.toString()}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ============ UI ============ */
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

export default async function Page({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string };
}) {
  const c = cookies();
  const emailCookie = c.get("app_email")?.value || "";
  const prog = await fetchProgrammeFromApi(emailCookie);

  let profile: Partial<ProfileT> = prog?.profile ?? {};
  let aiSessions: AiSessionT[] = prog?.sessions ?? [];

  if ((!profile.prenom || !profile.age) && emailCookie) {
    try {
      const answers = await getAnswersForEmail(emailCookie);
      if (answers) {
        profile = buildProfileFromAnswers(answers);
      }
    } catch {}
  }

  if (aiSessions.length === 0 && emailCookie) {
    try {
      const answers = await getAnswersForEmail(emailCookie);
      if (answers) {
        aiSessions = generateProgrammeFromAnswers(answers).sessions;
      }
    } catch {}
  }

  if (aiSessions.length === 0 && emailCookie) {
    try {
      aiSessions = await getAiSessions(emailCookie);
    } catch {}
  }

  // 🔥 fallback : toujours une séance affichée si vide
  if (aiSessions.length === 0) {
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
      },
    ];
  }

  const clientPrenom =
    typeof profile?.prenom === "string" && profile.prenom && !/\d/.test(profile.prenom)
      ? profile.prenom
      : "";
  const clientAge =
    typeof profile?.age === "number" && profile.age > 0 ? profile.age : undefined;
  const clientEmailDisplay = profile?.email || emailCookie;

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <h1 className="text-2xl font-bold mb-4">Mon profil</h1>

      <div className="card mb-4">
        <p><b>Prénom :</b> {clientPrenom || <i>Non renseigné</i>}</p>
        <p><b>Âge :</b> {clientAge ? `${clientAge} ans` : <i>Non renseigné</i>}</p>
        <p><b>Email :</b> {clientEmailDisplay || <i>Non renseigné</i>}</p>
      </div>

      <section>
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-xl font-semibold">Mon programme</h2>
            <p className="text-sm text-gray-600">
              Personnalisé via l’analyse de vos réponses.
            </p>
          </div>
          <form action={doAutogenAction}>
            <button type="submit" className="btn bg-black text-white px-3 py-2 rounded-md">
              ⚙️ Générer
            </button>
          </form>
        </div>

        <ul className="space-y-2">
          {aiSessions.map((s) => (
            <li key={s.id} className="card p-3 flex justify-between items-center">
              <a
                href={`/dashboard/seance/${encodeURIComponent(s.id)}?title=${encodeURIComponent(
                  s.title
                )}&date=${s.date}&type=${s.type}`}
                className="font-medium hover:underline"
              >
                {s.title}
              </a>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeBadgeClass(
                  s.type as WorkoutType
                )}`}
              >
                {s.type}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
