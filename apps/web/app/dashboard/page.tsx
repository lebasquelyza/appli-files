import { cookies } from "next/headers";
import Link from "next/link";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type KcalStore = Record<string, number>;
type Workout = { status: "active" | "done"; startedAt?: string; endedAt?: string };
type Store = { sessions: Workout[] };

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

export default async function Page() {
  const jar = cookies();
  const kcals = parseKcalStore(jar.get("app.kcals")?.value);
  const sessions = parseSessions(jar.get("app_sessions")?.value);
  const s: any = await getSession().catch(() => ({}));

  const today = todayISO();
  const todayKcal = kcals[today] || 0;

  // Placeholder “steps du jour” (en attendant une vraie source)
  const stepsToday = sessions.sessions.filter(x => x.status === "active").length;

  const lastDone = sessions.sessions
    .filter(x => x.status === "done")
    .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""))[0];

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      {/* En-tête compact */}
      <div className="page-header" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="h1" style={{ fontSize: 22 }}>Bienvenue 👋</h1>
          <p className="lead" style={{ fontSize: 13, marginTop: 4 }}>
            Aperçu rapide de ta progression et des données du jour.
          </p>
        </div>
      </div>

      {/* KPIs — carrés blancs .card */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Calories aujourd'hui" value={`${todayKcal.toLocaleString("fr-FR")} kcal`} href="/dashboard/calories" />
        <KpiCard title="Steps du jour" value={`${stepsToday}`} href="/dashboard/profile" />
        <KpiCard
          title="Dernière séance"
          value={lastDone?.endedAt ? new Date(lastDone.endedAt).toLocaleDateString("fr-FR") : "—"}
          href="/dashboard/profile"
        />
        <KpiCard title="Abonnement" value={s?.plan || "BASIC"} href="/dashboard/abonnement" />
      </section>

      {/* Actions rapides — carrés blancs .card */}
      <section className="grid gap-6 lg:grid-cols-2" style={{ marginTop: 12 }}>
        <article className="card">
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Calories</h3>
          <p className="text-sm" style={{ color: "#6b7280", marginTop: 4 }}>
            Consulte ton historique ou ajoute ta consommation d’aujourd’hui.
          </p>
          <div style={{ marginTop: 10 }}>
            <Link
              href="/dashboard/calories"
              className="btn btn-dash"
              style={{ padding: "8px 12px", fontWeight: 700 }}
            >
              Gérer mes calories →
            </Link>
          </div>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Entraînements</h3>
          <p className="text-sm" style={{ color: "#6b7280", marginTop: 4 }}>
            Crée, démarre ou consulte tes séances d’entraînement passées.
          </p>
          <div style={{ marginTop: 10 }}>
            <Link
              href="/dashboard/profile"
              className="btn btn-dash"
              style={{ padding: "8px 12px", fontWeight: 700 }}
            >
              Voir mes séances →
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}

function KpiCard({ title, value, href }: { title: string; value: string; href: string }) {
  return (
    <Link href={href}>
      <article className="card" style={{ cursor: "pointer" }}>
        <p className="text-xs" style={{ color: "#6b7280", marginBottom: 6 }}>{title}</p>
        <strong style={{ fontSize: 20, lineHeight: 1 }}>{value}</strong>
      </article>
    </Link>
  );
}

