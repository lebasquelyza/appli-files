// apps/web/app/dashboard/page.tsx
import { cookies } from "next/headers";
import Link from "next/link";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
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
  const activeCount = sessions.sessions.filter((x) => x.status === "active").length;
  const lastDone = sessions.sessions
    .filter((x) => x.status === "done")
    .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""))[0];

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      {/* En-tête simple */}
      <div className="page-header">
        <div>
          <h1 className="h1">Aperçu</h1>
          <p className="lead">Tes chiffres clés et tes raccourcis.</p>
        </div>
      </div>

      {/* Indicateurs (cartes blanches) */}
      <div className="grid gap-6 lg:grid-cols-4">
        <article className="card">
          <div className="text-sm" style={{ color: "#6b7280" }}>🔥 Calories aujourd’hui</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>
            {todayKcal.toLocaleString("fr-FR")} kcal
          </div>
          <div style={{ marginTop: 12 }}>
            <Link href="/dashboard/calories" className="btn btn-dash">Gérer</Link>
          </div>
        </article>

        <article className="card">
          <div className="text-sm" style={{ color: "#6b7280" }}>🏃 Séances actives</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{activeCount}</div>
          <div style={{ marginTop: 12 }}>
            <Link href="/dashboard/profile" className="btn">Ouvrir</Link>
          </div>
        </article>

        <article className="card">
          <div className="text-sm" style={{ color: "#6b7280" }}>📅 Dernière séance</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>
            {lastDone?.endedAt ? new Date(lastDone.endedAt).toLocaleDateString("fr-FR") : "—"}
          </div>
          <div style={{ marginTop: 12 }}>
            <Link href="/dashboard/profile" className="btn">Historique</Link>
          </div>
        </article>

        <article className="card">
          <div className="text-sm" style={{ color: "#6b7280" }}>💳 Abonnement</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{s?.plan || "BASIC"}</div>
          <div style={{ marginTop: 12 }}>
            <Link href="/dashboard/abonnement" className="btn">Gérer</Link>
          </div>
        </article>
      </div>

      {/* Deux grandes cartes comme les autres pages */}
      <div className="grid gap-6 lg:grid-cols-2" style={{ marginTop: 16 }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Calories</h3>
          <p className="text-sm" style={{ color: "#6b7280", marginTop: 4 }}>
            Ajoute ta consommation du jour et consulte l’historique (14 jours).
          </p>
          <div style={{ marginTop: 12 }}>
            <Link href="/dashboard/calories" className="btn btn-dash">Gérer mes calories</Link>
          </div>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Entraînements</h3>
          <p className="text-sm" style={{ color: "#6b7280", marginTop: 4 }}>
            Crée, démarre et consulte tes séances d’entraînement.
          </p>
          <div style={{ marginTop: 12 }}>
            <Link href="/dashboard/profile" className="btn btn-dash">Voir mes séances</Link>
          </div>
        </article>
      </div>
    </div>
  );
}
