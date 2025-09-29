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
    <div className="space-y-8">
      {/* Bandeau d’intro discret */}
      <section className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900">
              Aperçu du jour
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Suis tes chiffres clés et accède rapidement aux sections utiles.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
            {/* Petit badge de statut de l’abonnement */}
            <span className="inline-flex items-center rounded-full border px-2 py-1 bg-white">
              <span className="mr-1">⭐</span>
              {s?.plan || "BASIC"}
            </span>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon="🔥"
          title="Calories aujourd’hui"
          value={`${todayKcal.toLocaleString("fr-FR")} kcal`}
          href="/dashboard/calories"
          tone="emerald"
        />
        <Kpi
          icon="🏃"
          title="Séances actives"
          value={`${activeCount}`}
          href="/dashboard/profile"
          tone="sky"
        />
        <Kpi
          icon="📅"
          title="Dernière séance"
          value={lastDone?.endedAt ? new Date(lastDone.endedAt).toLocaleDateString("fr-FR") : "—"}
          href="/dashboard/profile"
          tone="amber"
        />
        <Kpi
          icon="💳"
          title="Abonnement"
          value={s?.plan || "BASIC"}
          href="/dashboard/abonnement"
          tone="violet"
        />
      </section>

      {/* Actions rapides */}
      <section className="grid gap-6 lg:grid-cols-2">
        <CardAction
          emoji="🍽️"
          title="Calories"
          desc="Ajoute ta conso du jour et consulte l’historique des 14 derniers jours."
          href="/dashboard/calories"
          cta="Gérer mes calories"
        />
        <CardAction
          emoji="💪"
          title="Entraînements"
          desc="Crée, démarre et termine tes séances. Historique clair et rapide."
          href="/dashboard/profile"
          cta="Voir mes séances"
        />
      </section>
    </div>
  );
}

/* ===== Petits composants ===== */

function Kpi({
  icon,
  title,
  value,
  href,
  tone = "emerald",
}: {
  icon: string;
  title: string;
  value: string;
  href: string;
  tone?: "emerald" | "sky" | "amber" | "violet";
}) {
  const tones: Record<string, string> = {
    emerald: "ring-emerald-100 bg-emerald-50/60",
    sky: "ring-sky-100 bg-sky-50/60",
    amber: "ring-amber-100 bg-amber-50/60",
    violet: "ring-violet-100 bg-violet-50/60",
  };

  return (
    <Link href={href}>
      <div className="group cursor-pointer rounded-2xl border bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition">
        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${tones[tone]} ring-4`}>
          <span className="text-base">{icon}</span>
        </div>
        <p className="mt-3 text-xs sm:text-sm text-gray-500">{title}</p>
        <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
        <div className="mt-2 text-sm font-semibold text-emerald-700 opacity-0 group-hover:opacity-100 transition">
          Ouvrir →
        </div>
      </div>
    </Link>
  );
}

function CardAction({
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
    <article className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition">
      <div className="flex items-start gap-3">
        <div className="text-xl">{emoji}</div>
        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{desc}</p>
        </div>
      </div>

      <Link
        href={href}
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 active:scale-[.99] transition"
      >
        {cta} →
      </Link>
    </article>
  );
}


