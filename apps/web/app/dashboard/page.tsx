// apps/web/app/dashboard/page.tsx
import { cookies } from "next/headers";
import Link from "next/link";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type KcalStore = Record<string, number>;
type Workout = { status: "active" | "done"; startedAt?: string; endedAt?: string };
type Store = { sessions: Workout[] };

/* ---------- Utils ---------- */
function parseKcalStore(raw?: string): KcalStore {
  try {
    return JSON.parse(raw || "{}") || {};
  } catch {
    return {};
  }
}
function parseSessions(raw?: string): Store {
  try {
    const o = JSON.parse(raw || "{}");
    return { sessions: Array.isArray(o?.sessions) ? o.sessions : [] };
  } catch {
    return { sessions: [] };
  }
}
function todayISO(tz = "Europe/Paris") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

/* ---------- Page ---------- */
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
    <div className="space-y-10">
      {/* ---- En-tête ---- */}
      <header>
        <h1 className="text-3xl font-extrabold">Bienvenue 👋</h1>
        <p className="text-gray-600 mt-1">
          Voici un aperçu de ta progression et de tes données d’aujourd’hui.
        </p>
      </header>

      {/* ---- Indicateurs clés ---- */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Calories aujourd'hui"
          value={`${todayKcal.toLocaleString("fr-FR")} kcal`}
          href="/dashboard/calories"
        />
        <Kpi title="Séances actives" value={`${activeCount}`} href="/dashboard/profile" />
        <Kpi
          title="Dernière séance"
          value={lastDone?.endedAt ? new Date(lastDone.endedAt).toLocaleDateString("fr-FR") : "—"}
          href="/dashboard/profile"
        />
        <Kpi title="Abonnement" value={s?.plan || "BASIC"} href="/dashboard/abonnement" />
      </section>

      {/* ---- Actions rapides ---- */}
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="card bg-white p-6 rounded-2xl shadow-sm">
          <h3 className="font-bold text-lg mb-2">Calories</h3>
          <p className="text-sm text-gray-600 mb-4">
            Consulte ton historique ou ajoute ta consommation d’aujourd’hui.
          </p>
          <Link
            href="/dashboard/calories"
            className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
          >
            Gérer mes calories →
          </Link>
        </article>

        <article className="card bg-white p-6 rounded-2xl shadow-sm">
          <h3 className="font-bold text-lg mb-2">Entraînements</h3>
          <p className="text-sm text-gray-600 mb-4">
            Crée, démarre ou consulte tes séances d’entraînement passées.
          </p>
          <Link
            href="/dashboard/profile"
            className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
          >
            Voir mes séances →
          </Link>
        </article>
      </section>
    </div>
  );
}

/* ---------- Composant KPI (clean, sans flèche) ---------- */
function Kpi({ title, value, href }: { title: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition"
    >
      <div className="p-5">
        <p className="text-[11px] uppercase tracking-wide text-gray-500">{title}</p>
        <p className="mt-1 text-3xl font-extrabold text-gray-900">{value}</p>
      </div>
    </Link>
  );
}

