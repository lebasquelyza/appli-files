import { getSession, updateProfile } from "@/lib/session";
import { Crown, Image as ImageIcon, Save, User as UserIcon, Check } from "lucide-react";

export default function Page() {
  const s = getSession();

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-8 text-white shadow-lg">
        <h1 className="text-3xl font-semibold tracking-tight">Mon profil</h1>
        <p className="mt-1 text-white/80">Photo, identité et formule d’abonnement</p>
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-40 w-40 rotate-12 rounded-3xl bg-white/10 blur-xl" />
      </div>

      <form action={updateProfile} className="mt-6 space-y-8">
        {/* Card: Informations */}
        <div className="rounded-2xl border border-zinc-200 bg-white/60 p-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/40">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-900">Informations</h2>
            <span className="text-xs text-zinc-500">Mettez à jour votre identité et votre photo</span>
          </div>

          <div className="grid gap-6 sm:grid-cols-[auto,1fr]">
            {/* Avatar preview */}
            <div className="flex flex-col items-center gap-3">
              <div className="h-24 w-24 overflow-hidden rounded-2xl ring-1 ring-zinc-200">
                {s?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.image}
                    alt={s?.name || "Avatar"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-100">
                    <UserIcon className="h-8 w-8 text-zinc-400" />
                  </div>
                )}
              </div>
              <span className="text-xs text-zinc-500">Prévisualisation</span>
            </div>

            {/* Fields */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-zinc-700">Nom affiché</label>
                <input
                  name="name"
                  defaultValue={s?.name || ""}
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white/50 px-3 py-2 shadow-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  placeholder="Jane Doe"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-zinc-700">Photo (URL)</label>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white/60">
                    <ImageIcon className="h-4 w-4 text-zinc-500" />
                  </div>
                  <input
                    name="image"
                    defaultValue={s?.image || ""}
                    placeholder="https://…"
                    className="w-full rounded-xl border border-zinc-200 bg-white/50 px-3 py-2 shadow-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-500">Collez une URL d’image (JPG, PNG, GIF).</p>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-zinc-700">Formule</label>
                <div className="relative mt-2">
                  <select
                    name="plan"
                    defaultValue={s?.plan || "BASIC"}
                    className="w-full appearance-none rounded-xl border border-zinc-200 bg-white/50 px-3 py-2 pr-10 shadow-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  >
                    <option value="BASIC">Basic</option>
                    <option value="PLUS">Plus</option>
                    <option value="PREMIUM">Premium</option>
                  </select>
                  <Crown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                </div>
              </div>

              <div className="sm:col-span-1 self-end">
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 active:translate-y-px"
                >
                  <Save className="h-4 w-4" />
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card: Avantages des formules */}
        <div className="rounded-2xl border border-zinc-200 bg-white/60 p-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/40">
          <h3 className="mb-4 text-sm font-semibold text-zinc-800">Avantages des formules</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <PlanCard
              title="Basic"
              subtitle="Gratuit"
              items={["Profil personnalisé", "Support standard"]}
              highlight={s?.plan === "BASIC"}
            />
            <PlanCard
              title="Plus"
              subtitle="Meilleur rapport qualité/prix"
              items={["Fonctionnalités avancées", "Priorité modérée"]}
              highlight={s?.plan === "PLUS"}
            />
            <PlanCard
              title="Premium"
              subtitle="Tout illimité"
              items={["Toutes les fonctionnalités", "Support prioritaire 24/7"]}
              highlight={s?.plan === "PREMIUM"}
            />
          </div>
        </div>
      </form>
    </div>
  );
}

function PlanCard({
  title,
  subtitle,
  items,
  highlight,
}: {
  title: string;
  subtitle?: string;
  items: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "relative rounded-2xl border p-5 shadow-sm transition " +
        (highlight
          ? "border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-200"
          : "border-zinc-200 bg-white/60 hover:border-zinc-300")
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <Crown className={"h-4 w-4 " + (highlight ? "text-indigo-600" : "text-zinc-400")} />
        <div>
          <div className="text-sm font-medium text-zinc-900">{title}</div>
          {subtitle ? <div className="text-xs text-zinc-500">{subtitle}</div> : null}
        </div>
      </div>
      <ul className="space-y-2 text-sm text-zinc-700">
        {items.map((it) => (
          <li key={it} className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
      {highlight ? (
        <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-indigo-600/10 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/30">
          Actuel
        </span>
      ) : null}
    </div>
  );
}
