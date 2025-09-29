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
    <div className="space-y-6">
      {/* Carte d’intro (discrète) */}
      <section className="rounded-2xl border bg-white shadow-sm p-5">
        <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-gray-900">
          Aperçu du jour
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Tes chiffres clés et tes raccourcis.
        </p>
      </section>

      {/* KPI en “carrés” blancs */}
      <section className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Calories aujourd’hui" value={`${todayKcal.toLocaleString("fr-FR")} kcal`} href="/dashboard/calories" emoji="🔥" />
        <KpiCard title="Séances actives" value={`${activeCount}`} href="/dashboard/profile" emoji="🏃" />
        <KpiCard title="Dernière séance" value={lastDone?.endedAt ? new Date(lastDone.endedAt).toLocaleDateString("fr-FR") : "—"} href="/dashboard/profile" emoji="📅" />
        <KpiCard title="Abonnement" value={s?.plan || "BASIC"} href="/dashboard/abonnement" emoji="💳" />
      </section>

      {/* Deux grosses cartes blanches */}
      <section className="grid gap-6 lg:grid-cols-2">
        <BigCard
          emoji="🍽️"
          title="Calories"
          desc="Ajoute ta conso du jour et consulte l’historique (14 jours)."
          href="/dashboard/calories"
          cta="Gérer mes calories"
        />
        <BigCard
          emoji="💪"
          title="Entraînements"
          desc="Crée, démarre et consulte tes séances d’entraînement."
          href="/dashboard/profile"
          cta="Voir mes séances"
        />
      </section>
    </div>
  );
}

/* ========= Composants de carte (carrés blancs) ========= */

function KpiCard({
  emoji,
  title,
  value,
  href,
}: {
  emoji: string;
  title: string;
  value: string;
  href: string;
}) {
  return (
    <Link href={href} className="block">
      <div className="rounded-2xl border bg-white shadow-sm p-4 sm:p-5 min-h-[120px] flex flex-col justify-between hover:shadow-md transition">
        <div className="flex items-center gap-2">
          <span className="text-base">{emoji}</span>
          <p className="text-xs sm:text-sm text-gray-600">{title}</p>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </Link>
  );
}

function BigCard({
  emoji,
  title,
  desc,
  href,
  cta,
}: {
  emoji: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <article className="rounded-2xl border bg-white shadow-sm p-6 flex flex-col justify-between">
      <div className="flex items-start gap-3">
        <div className="text-xl">{emoji}</div>
        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{desc}</p>
        </div>
      </div>

      <Link
        href={href}
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 active:scale-[.99] transition self-start"
      >
        {cta} →
      </Link>
    </article>
  );
}
