// apps/web/app/dashboard/page.tsx
import { cookies } from "next/headers";
import Link from "next/link";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type KcalStore = Record<string, number>;
type Workout = { status: "active" | "done"; startedAt?: string; endedAt?: string };
type Store = { sessions: Workout[] };

type Lang = "fr" | "en";

function parseKcalStore(raw?: string): KcalStore {
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}
function parseSessions(raw?: string): Store {
  try {
    const o = JSON.parse(raw || "{}");
    return { sessions: Array.isArray(o?.sessions) ? o.sessions : [] };
  } catch { return { sessions: [] }; }
}
function todayISO(tz = "Europe/Paris") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

/** Textes FR/EN centralisés pour préparer la trad */
const TEXTS: Record<Lang, {
  headerTitle: string;
  headerSubtitle: string;
  kpiCaloriesTitle: string;
  kpiStepsTitle: string;
  kpiLastSessionTitle: string;
  kpiManage: string;
  caloriesCardTitle: string;
  caloriesCardText: string;
  caloriesCardButton: string;
  workoutsCardTitle: string;
  workoutsCardText: string;
  workoutsCardButton: string;
}> = {
  fr: {
    headerTitle: "Bienvenue 👋",
    headerSubtitle: "Aperçu rapide de ta progression et des données du jour.",
    kpiCaloriesTitle: "Calories aujourd'hui",
    kpiStepsTitle: "Steps du jour",
    kpiLastSessionTitle: "Dernière séance",
    kpiManage: "Gérer",
    caloriesCardTitle: "Calories",
    caloriesCardText: "Consulte ton historique ou ajoute ta consommation d’aujourd’hui.",
    caloriesCardButton: "Gérer mes calories →",
    workoutsCardTitle: "Entraînements",
    workoutsCardText: "Crée, démarre ou consulte tes séances d’entraînement passées.",
    workoutsCardButton: "Voir mes séances →",
  },
  en: {
    headerTitle: "Welcome 👋",
    headerSubtitle: "Quick overview of your progress and today's data.",
    kpiCaloriesTitle: "Calories today",
    kpiStepsTitle: "Steps today",
    kpiLastSessionTitle: "Last session",
    kpiManage: "Manage",
    caloriesCardTitle: "Calories",
    caloriesCardText: "View your history or add today's intake.",
    caloriesCardButton: "Manage my calories →",
    workoutsCardTitle: "Workouts",
    workoutsCardText: "Create, start, or review your past workout sessions.",
    workoutsCardButton: "View my sessions →",
  },
};

export default async function Page() {
  const jar = cookies();
  const kcals = parseKcalStore(jar.get("app.kcals")?.value);
  const sessions = parseSessions(jar.get("app_sessions")?.value);
  const s: any = await getSession().catch(() => ({}));

  // Langue simple basée sur la session (fallback FR)
  const lang: Lang = s?.lang === "en" ? "en" : "fr";
  const txt = TEXTS[lang];

  const today = todayISO();
  const todayKcal = kcals[today] || 0;

  // Placeholder “steps du jour” (en attendant une vraie source)
  const stepsToday = sessions.sessions.filter(x => x.status === "active").length;

  const lastDone = sessions.sessions
    .filter(x => x.status === "done")
    .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""))[0];

  const lastSessionDate =
    lastDone?.endedAt
      ? new Date(lastDone.endedAt).toLocaleDateString(
          lang === "en" ? "en-US" : "fr-FR"
        )
      : "—";

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      {/* En-tête compact */}
      <div className="page-header" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="h1" style={{ fontSize: 22, color: "#111827" }}>
            {txt.headerTitle}
          </h1>
          <p className="lead" style={{ fontSize: 13, marginTop: 4 }}>
            {txt.headerSubtitle}
          </p>
        </div>
      </div>

      {/* KPIs — carrés blancs .card avec bouton GÉRER */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={txt.kpiCaloriesTitle}
          value={`${todayKcal.toLocaleString(lang === "en" ? "en-US" : "fr-FR")} kcal`}
          href="/dashboard/calories"
          manageLabel={txt.kpiManage}
        />
        <KpiCard
          title={txt.kpiStepsTitle}
          value={`${stepsToday}`}
          href="/dashboard/progress"
          manageLabel={txt.kpiManage}
        />
        <KpiCard
          title={txt.kpiLastSessionTitle}
          value={lastSessionDate}
          href="/dashboard/profile"
          manageLabel={txt.kpiManage}
        />
      </section>

      {/* Actions rapides — SANS bouton Gérer */}
      <section className="grid gap-6 lg:grid-cols-2" style={{ marginTop: 12 }}>
        <article className="card">
          <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>
            {txt.caloriesCardTitle}
          </h3>
          <p className="text-sm" style={{ color: "#6b7280", marginTop: 8 }}>
            {txt.caloriesCardText}
          </p>
          <div style={{ marginTop: 10 }}>
            <Link
              href="/dashboard/calories"
              className="btn btn-dash"
              style={{ padding: "8px 12px", fontWeight: 700 }}
            >
              {txt.caloriesCardButton}
            </Link>
          </div>
        </article>

        <article className="card">
          <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>
            {txt.workoutsCardTitle}
          </h3>
          <p className="text-sm" style={{ color: "#6b7280", marginTop: 8 }}>
            {txt.workoutsCardText}
          </p>
          <div style={{ marginTop: 10 }}>
            <Link
              href="/dashboard/profile"
              className="btn btn-dash"
              style={{ padding: "8px 12px", fontWeight: 700 }}
            >
              {txt.workoutsCardButton}
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}

function KpiCard({
  title,
  value,
  href,
  manageLabel,
}: {
  title: string;
  value: string;
  href: string;
  manageLabel?: string;
}) {
  return (
    <article className="card" style={{ cursor: "default" }}>
      {/* Ligne titre + bouton gérer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <p className="text-xs" style={{ color: "#111827", margin: 0 }}>
          {title}
        </p>
        {manageLabel && (
          <Link
            href={href}
            className="inline-flex items-center"
            style={{
              background: "#059669",
              color: "#ffffff",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {manageLabel}
          </Link>
        )}
      </div>

      {/* Valeur cliquable vers la page liée */}
      <Link href={href}>
        <div style={{ marginTop: 8 }}>
          <strong
            style={{
              fontSize: 20,
              lineHeight: 1,
              color: "#111827",
            }}
          >
            {value}
          </strong>
        </div>
      </Link>
    </article>
  );
}
