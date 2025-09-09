// apps/web/app/dashboard/abonnement/page.tsx
import { PageHeader, Section } from "@/components/ui/Page";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Plan = "BASIC" | "PLUS" | "PREMIUM";

type PlanCard = {
  code: Plan;
  title: string;
  price: string;     // affichage
  priceEUR: number;  // numérique pour total
  tagline: string;
  features: string[];
  cta: string;
};

const PLANS: PlanCard[] = [
  {
    code: "BASIC",
    title: "Basic",
    price: "9,90 € / mois",
    priceEUR: 9.90,
    tagline: "Recettes + Minuteur",
    features: [
      "Recettes générales",
      "Minuteur d’exercices",
      "Support par email",
    ],
    cta: "Choisir Basic",
  },
  {
    code: "PLUS",
    title: "Plus",
    price: "19,90 € / mois",
    priceEUR: 19.90,
    tagline: "Basic + Personnalisation",
    features: [
      "Recettes personnalisées (IA)",
      "Filtres avancés (allergènes, régimes)",
      "Historique & favoris",
    ],
    cta: "Choisir Plus",
  },
  {
    code: "PREMIUM",
    title: "Premium",
    price: "39,90 € / mois",
    priceEUR: 39.90,
    tagline: "Plus + IA correction",
    features: [
      "Plans repas hebdo IA",
      "Correction vidéo des exercices",
      "Priorité support",
    ],
    cta: "Choisir Premium",
  },
];

// Options Coaching+ (suppléments mensuels)
const CPLUS = {
  none:  { label: "Sans option Coaching+", extra: 0 },
  visio1:{ label: "1 visio/mois avec coach (+20 €)", extra: 20 },
  real1: { label: "1 séance réelle/mois (+40 €)", extra: 40 },
  real4: { label: "Pack 4 séances réelles/mois (+140 €)", extra: 140 },
  real8: { label: "Pack 8 séances réelles/mois (+240 €)", extra: 240 },
} as const;
type CPlusKey = keyof typeof CPLUS;

// ---- Server Action : change la formule + option coaching dans la session (cookie) ----
async function choosePlanAction(formData: FormData) {
  "use server";
  const plan = (formData.get("plan") || "").toString().toUpperCase() as Plan;
  const option = ((formData.get("option") || "none").toString()) as CPlusKey;

  if (!["BASIC", "PLUS", "PREMIUM"].includes(plan)) {
    redirect("/dashboard/abonnement?error=plan_invalide");
  }
  if (!(option in CPLUS)) {
    redirect("/dashboard/abonnement?error=option_invalide");
  }

  // Lit l’ancienne session (si existante)
  let s: any = {};
  try { s = await getSession(); } catch {}

  // Calcule des dates mensuelles fictives
  const now = new Date();
  const nextPaymentAt = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const expiresAt     = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  // Total mensuel = base (plan) + option
  const base = PLANS.find(p => p.code === plan)?.priceEUR ?? 0;
  const extra = CPLUS[option].extra;
  const monthlyTotal = base + extra;

  const updated = {
    ...s,
    plan,
    nextPaymentAt: nextPaymentAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    coachingOption: option,                 // ex: 'visio1'
    coachingExtraEUR: extra,                // ex: 20
    monthlyTotalEUR: Number(monthlyTotal.toFixed(2)),
    lastUpdatedAt: now.toISOString(),
  };

  // Sauvegarde en cookie
  cookies().set("app_session", JSON.stringify(updated), { path: "/" });

  redirect("/dashboard/abonnement?success=1");
}

function fmt(dateISO?: string | null) {
  if (!dateISO) return "—";
  try {
    return new Date(dateISO).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
  } catch { return "—"; }
}

export default async function Page({ searchParams }: { searchParams?: { success?: string; error?: string } }) {
  const s: any = await getSession();
  const plan: Plan = (s?.plan as Plan) || "BASIC";
  const option: CPlusKey = (s?.coachingOption as CPlusKey) || "none";
  const basePrice = PLANS.find(p => p.code === plan)?.priceEUR ?? 0;
  const total = typeof s?.monthlyTotalEUR === "number" ? s.monthlyTotalEUR : (basePrice + (CPLUS[option]?.extra ?? 0));

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <PageHeader
        title="Abonnement"
        subtitle="Gérez votre plan ou passez à une formule supérieure"
      />

      {/* État abonnement */}
      <div className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2>Votre abonnement</h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="badge">Plan actuel</span>
              <strong style={{ fontSize: 18 }}>{plan}</strong>
            </div>

            <div className="text-sm" style={{ color: "#6b7280", marginTop: 8 }}>
              Prochain prélèvement : <strong>{fmt(s?.nextPaymentAt)}</strong><br />
              Expiration : <strong>{fmt(s?.expiresAt)}</strong><br />
              Option Coaching+ : <strong>{CPLUS[option]?.label || "—"}</strong><br />
              Total mensuel : <strong>{total.toFixed(2).replace(".", ",")} €</strong>
            </div>

            {searchParams?.success && (
              <div className="badge" style={{ marginTop: 10 }}>Mise à jour enregistrée ✓</div>
            )}
            {searchParams?.error && (
              <div className="badge" style={{ marginTop: 10 }}>Erreur : {searchParams.error}</div>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>Infos</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Le changement de plan est immédiat dans l’app.</li>
              <li>Le paiement réel n’est pas encore branché (démo).</li>
              <li>Vous pouvez changer/annuler à tout moment.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Choix des formules (cartes avec prix + option Coaching+) */}
      <Section title="Formules">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((p) => {
            const isCurrent = p.code === plan;
            return (
              <article key={p.code} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div className="flex items-center justify-between">
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{p.title}</h3>
                    <span className="badge">{p.code}</span>
                  </div>
                  <div className="text-sm" style={{ color: "#6b7280", marginTop: 4 }}>{p.tagline}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginTop: 10 }}>{p.price}</div>

                  <ul style={{ marginTop: 10, paddingLeft: 18 }}>
                    {p.features.map((f) => <li key={f}>{f}</li>)}
                  </ul>

                  <div style={{ marginTop: 12 }}>
                    <label className="label">Option Coaching+</label>
                    {/* Valeur présélectionnée = option actuelle si ce plan est le plan courant, sinon "none" */}
                    <select className="input" name="option" form={`form-${p.code}`} defaultValue={isCurrent ? (option || "none") : "none"}>
                      {Object.entries(CPLUS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <div className="text-sm" style={{ color: "#6b7280", marginTop: 6 }}>
                      Total (indicatif): {p.price}
                    </div>
                  </div>
                </div>

                <form id={`form-${p.code}`} action={choosePlanAction} style={{ marginTop: 12 }}>
                  <input type="hidden" name="plan" value={p.code} />
                  <button className="btn btn-dash" type="submit">
                    {isCurrent ? "Mettre à jour" : p.cta}
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
