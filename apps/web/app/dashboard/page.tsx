import { cookies } from "next/headers";
import Link from "next/link";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type KcalStore = Record<string, number>;
type Workout = { status: "active" | "done"; startedAt?: string; endedAt?: string };
type Store = { sessions: Workout[] };

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

export default async function Page() {
  const jar = cookies();
  const kcals = parseKcalStore(jar.get("app.kcals")?.value);
  const sessions = parseSessions(jar.get("app_sessions")?.value);
  const s: any = await getSession().catch(() => ({}));

  const today = todayISO();
  const todayKcal = kcals[today] || 0;

  // En attendant un vrai compteur de pas, on garde la même source que précédemment
  const stepsToday = sessions.sessions.filter((x) => x.status === "active").length;

  const lastDone = sessions.sessions
    .filter((x) => x.status === "done")
    .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""))[0];

  return (
    <div className="space-y-8">
      {/* ---- En-tête (typo allégée) ---- */}
      <div className="flex flex-col lg:flex-row items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Bienvenue 👋</h1>
          <p className="text-gray-600 mt-1 text-[13px] leading-5">
            Un aperçu rapide de ta progression et des données du jour.
          </p>
        </div>
      </div>

      {/* ---- Indicateurs clés (cartes blanches compactes) ---- */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Calories aujourd'hui"
          value={`${todayKcal.toLocaleString("fr-FR")} kcal`}
          href="/dashboard/calories"
        />
        <Kpi title="Steps du jour" value={`${stepsToday}`} href="/dashboard/profile" />
        <Kpi
          title="Dernière séance"
          value={lastDone?.endedAt ? new Date(lastDone.endedAt).toLocaleDateString("fr-FR") : "—"}
          href="/dashboard/profile"
        />
        <Kpi title="Abonnement" value={s?.plan || "BASIC"} href="/dashboard/abonnement" />
      </section>

      {/* ---- Actions rapides (cartes blanches + typo réduite) ---- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="bg-white p-5 rounded-2xl shadow-sm">
          <h3 className="font-bold text-base mb-1">Calories</h3>
          <p className="text-[13px] text-gray-600 mb-3">
            Consulte ton historique ou ajoute ta consommation d’aujourd’hui.
          </p>
          <Link
            href="/dashboard/calories"
            className="inline-block px-3 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 transition"
          >
            Gérer mes calories →
          </Link>
        </article>

        <article className="bg-white p-5 rounded-2xl shadow-sm">
          <h3 className="font-bold text-base mb-1">Entraînements</h3>
          <p className="text-[13px] text-gray-600 mb-3">
            Crée, démarre ou consulte tes séances d’entraînement passées.
          </p>
          <Link
            href="/dashboard/profile"
            className="inline-block px-3 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 transition"
          >
            Voir mes séances →
          </Link>
        </article>
      </section>
    </div>
  );
}

function Kpi({ title, value, href }: { title: string; value: string; href: string }) {
  return (
    <Link href={href}>
      <div className="p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition cursor-pointer">
        <p className="text-[12px] text-gray-500 mb-1">{title}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </Link>
  );
}


