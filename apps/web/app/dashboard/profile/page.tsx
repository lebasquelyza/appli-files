import { getSession, updateProfile } from "@/lib/session";
import { PageHeader, Section } from "@/components/ui/Page";
import { Crown, BadgeCheck, UserRound } from "lucide-react";
import React from "react";

// Petit badge de plan, avec couleurs et icône
function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, { label: string; cls: string; Icon: any }> = {
    BASIC: {
      label: "Basic",
      cls: "bg-gray-100 text-gray-700 ring-gray-200",
      Icon: UserRound,
    },
    PLUS: {
      label: "Plus",
      cls: "bg-sky-100 text-sky-700 ring-sky-200",
      Icon: BadgeCheck,
    },
    PREMIUM: {
      label: "Premium",
      cls: "bg-amber-100 text-amber-800 ring-amber-200",
      Icon: Crown,
    },
  };
  const { label, cls, Icon } = map[plan] ?? map["BASIC"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${cls}`}>
      <Icon className="h-4 w-4" /> {label}
    </span>
  );
}

// Carte générique
function Card({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`rounded-2xl border bg-white/60 backdrop-blur shadow-sm ring-1 ring-black/5 ${className}`}>
      {children}
    </div>
  );
}

export default async function Page() {
  const s = await getSession();
  const plan = s?.plan ?? "BASIC";
  const img = s?.image || "https://api.dicebear.com/8.x/initials/svg?seed=" + encodeURIComponent(s?.name ?? "Utilisateur");

  return (
    <>
      {/* En‑tête */}
      <div className="relative overflow-hidden rounded-3xl border ring-1 ring-black/5">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 opacity-20" />
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <img
                src={img}
                alt="Avatar"
                className="h-16 w-16 rounded-full ring-2 ring-white object-cover"
              />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Mon profil</h1>
                <p className="text-sm text-gray-600">Photo, identité et formule d’abonnement</p>
              </div>
            </div>
            <PlanBadge plan={plan} />
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Colonne gauche : aperçu profil */}
        <div className="xl:col-span-1">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <img src={img} alt="Avatar" className="h-20 w-20 rounded-full border object-cover" />
              <div>
                <div className="text-base font-medium">{s?.name || "Utilisateur"}</div>
                <div className="text-sm text-gray-600">Plan actuel</div>
                <div className="mt-1">
                  <PlanBadge plan={plan} />
                </div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border p-3">
                <div className="text-gray-500">Identifiant</div>
                <div className="font-medium truncate">{s?.id ?? "—"}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-gray-500">Email</div>
                <div className="font-medium truncate">{s?.email ?? "—"}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Colonne droite : formulaire */}
        <div className="xl:col-span-2">
          <Section title="Informations">
            <Card className="p-6">
              <form action={updateProfile} className="space-y-6">
                {/* Nom affiché */}
                <div>
                  <label className="label text-sm font-medium">Nom affiché</label>
                  <input
                    name="name"
                    className="input mt-1 w-full rounded-xl border px-3 py-2 shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-400"
                    defaultValue={s?.name || ""}
                    placeholder="Votre nom public"
                  />
                </div>

                {/* Photo */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
                  <div>
                    <label className="label text-sm font-medium">Photo (URL)</label>
                    <input
                      name="image"
                      className="input mt-1 w-full rounded-xl border px-3 py-2 shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-400"
                      defaultValue={s?.image || ""}
                      placeholder="https://…"
                      inputMode="url"
                    />
                    <p className="mt-1 text-xs text-gray-500">Collez une URL d’image publique. L’aperçu se met à jour ci‑dessous.</p>
                  </div>
                  <div className="justify-self-start md:justify-self-end">
                    <img
                      src={s?.image || img}
                      alt="Aperçu"
                      className="h-20 w-20 rounded-lg border object-cover"
                    />
                  </div>
                </div>

                {/* Plan */}
                <div>
                  <label className="label text-sm font-medium">Formule</label>
                  <select
                    name="plan"
                    className="input mt-1 w-full rounded-xl border bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    defaultValue={plan}
                  >
                    <option value="BASIC">Basic</option>
                    <option value="PLUS">Plus</option>
                    <option value="PREMIUM">Premium</option>
                  </select>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-gray-500">Les modifications s’appliquent immédiatement après l’enregistrement.</div>
                  <button className="btn inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 font-medium text-white shadow hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400">
                    <BadgeCheck className="h-4 w-4" /> Enregistrer
                  </button>
                </div>
              </form>
            </Card>

            {/* Avantages du plan (optionnel, purement visuel) */}
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                { title: "Qualité audio", basic: "Standard", plus: "HD", premium: "Hi‑Fi" },
                { title: "Playlists", basic: "Illimitées", plus: "Illimitées + collab.", premium: "+ Smart Mix" },
                { title: "Téléchargement", basic: "—", plus: "—", premium: "Oui" },
              ].map((f) => (
                <div key={f.title} className="rounded-2xl border p-4">
                  <div className="text-sm text-gray-500">{f.title}</div>
                  <div className="mt-1 text-base font-medium">
                    {plan === "PREMIUM" ? f.premium : plan === "PLUS" ? f.plus : f.basic}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
