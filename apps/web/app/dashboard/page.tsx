// apps/web/app/dashboard/page.tsx
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
  try { const o = JSON.parse(raw || "{}"); return { sessions: Array.isArray(o?.sessions) ? o.sessions : [] }; }
  catch { return { sessions: [] }; }
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
  const activeCount = sessions.sessions.filter((x) => x.status === "active").length;
  const lastDone = sessions.sessions
    .filter((x) => x.status === "done")
    .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""))[0];

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 28 }}>
      {/* En-tête discret */}
      <div className="page-header" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="h1" style={{ fontSize: 20, fontWeight: 800 }}>Aperçu du jour</h1>
          <p className="lead" style={{ fontSize: 13 }}>
            Tes chiffres clés et tes raccourcis.
          </p>
        </div>
      </div>

      {/* KPI (cartes blanches, typo réduite) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ marginBottom: 12 }}>
        <KpiCard
          title="Calories aujourd’hui"
          value={`${todayKcal.toLocaleString("fr-FR")} kcal`}
          href="/dashboard/calories"
        />
        <KpiCard title="Séances actives" value={String(activeCount)} href="/dashboard/profile" />
        <KpiCard
          title="Dernière séance"
          value={lastDone?.endedAt ? new Date(lastDone.endedAt).toLocaleDateString("fr-FR") : "—"}
          href="/dashboard/profile"
        />
        <KpiCard title="Abonnement" value={s?.plan || "BASIC"} href="/dashboard/abonnement" />
      </section>

      {/* Actions rapides (cards blanches) */}
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="card">
          <div style={{ display: "grid", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Calories</h3>
            <p className="text-sm" style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
              Ajoute ta conso d’aujourd’hui et consulte l’historique (14 jours).
            </p>
            <Link
              href="/dashboard/calories"
              className="btn btn-dash"
              style={{ width: "fit-content", padding: "8px 12px", fontSize: 14, fontWeight: 700 }}
            >
              Gérer mes calories →
            </Link>
          </div>
        </article>

        <article className="card">
          <div style={{ display: "grid", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Entraînements</h3>
            <p className="text-sm" style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
              Crée, démarre ou consulte tes séances d’entraînement passées.
            </p>
            <Link
              href="/dashboard/profile"
              className="btn btn-dash"
              style={{ width: "fit-content", padding: "8px 12px", fontSize: 14, fontWeight: 700 }}
            >
              Voir mes séances →
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}

/* ---------- Petites cartes KPI cohérentes avec tes "card" ---------- */
function KpiCard({ title, value, href }: { title: string; value: string; href: string }) {
  return (
    <Link href={href} className="card" style={{ textDecoration: "none" }}>
      <div style={{ display: "grid", gap: 6 }}>
        <p className="text-sm" style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
          {title}
        </p>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>{value}</p>
      </div>
    </Link>
  );
}

