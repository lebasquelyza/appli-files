// apps/web/app/dashboard/abonnement/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

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
  { code:"BASIC", title:"Basic", price:"9,90 € / mois", priceEUR:9.90, tagline:"Recettes + Minuteur",
    features:["Recettes générales","Minuteur d’exercices","Support par email"], cta:"Choisir Basic" },
  { code:"PLUS", title:"Plus", price:"19,90 € / mois", priceEUR:19.90, tagline:"Basic + Personnalisation",
    features:["Recettes personnalisées (IA)","Filtres avancés (allergènes, régimes)","Historique & favoris"], cta:"Choisir Plus" },
  { code:"PREMIUM", title:"Premium", price:"39,90 € / mois", priceEUR:39.90, tagline:"Plus + IA correction",
    features:["Plans repas hebdo IA","Correction vidéo des exercices","Priorité support"], cta:"Choisir Premium" },
];

const CPLUS = {
  none:  { label: "Sans option Coaching+", extra: 0 },
  visio1:{ label: "1 visio/mois avec coach (+20 €)", extra: 20 },
  real1: { label: "1 séance réelle/mois (+40 €)", extra: 40 },
  real4: { label: "Pack 4 séances réelles/mois (+140 €)", extra: 140 },
  real8: { label: "Pack 8 séances réelles/mois (+240 €)", extra: 240 },
} as const;
type CPlusKey = keyof typeof CPLUS;

/** Server Action: choisir/mettre à jour le plan */
async function choosePlanAction(formData: FormData) {
  "use server";
  const plan = (formData.get("plan") || "").toString().toUpperCase() as Plan;
  const option = (formData.get("option") || "none").toString() as CPlusKey;

  if (!["BASIC","PLUS","PREMIUM"].includes(plan)) redirect("/dashboard/abonnement?error=plan_invalide");
  if (!(option in CPLUS)) redirect("/dashboard/abonnement?error=option_invalide");

  let s: any = {};
  try { s = await getSession(); } catch {}

  const now = new Date();
  const nextPaymentAt = plan === "BASIC" ? null : new Date(now.getFullYear(), now.getMonth()+1, now.getDate());
  const expiresAt     = plan === "BASIC" ? null : new Date(now.getFullYear(), now.getMonth()+1, now.getDate());

  const base = PLANS.find(p => p.code === plan)?.priceEUR ?? 0;
  const extra = CPLUS[option].extra;
  const monthlyTotal = base + extra;

  const updated = {
    ...s,
    plan,
    nextPaymentAt: nextPaymentAt ? nextPaymentAt.toISOString() : null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    coachingOption: option,
    coachingExtraEUR: extra,
    monthlyTotalEUR: Number(monthlyTotal.toFixed(2)),
    lastUpdatedAt: now.toISOString(),
  };

  cookies().set("app_session", JSON.stringify(updated), { path:"/" });
  redirect("/dashboard/abonnement?success=1");
}

function fmt(dateISO?: string|null) {
  if (!dateISO) return "—";
  try { return new Date(dateISO).toLocaleDateString("fr-FR", { year:"numeric", month:"long", day:"numeric" }); }
  catch { return "—"; }
}

export default async function Page({ searchParams }: { searchParams?: { success?: string; error?: string } }) {
  const s: any = await getSession().catch(() => ({}));
  const plan: Plan = (s?.plan as Plan) || "BASIC";
  const option: CPlusKey = (s?.coachingOption as CPlusKey) || "none";
  const basePrice = PLANS.find(p => p.code === plan)?.priceEUR ?? 0;
  const total = typeof s?.monthlyTotalEUR === "number" ? s.monthlyTotalEUR : (basePrice + (CPLUS[option]?.extra ?? 0));

  return (
    <div className="container" style={{ paddingTop:24, paddingBottom:32 }}>
      {/* Header */}
      <header className="page-header" style={{ marginBottom:18 }}>
        <div>
          <h1 className="h1">Abonnement</h1>
          <p className="lead">Gérez votre plan ou passez à une formule supérieure</p>
        </div>
      </header>

      {/* État abonnement */}
      <section className="section" style={{ marginTop:12 }}>
        <div className="section-head" style={{ marginBottom:8 }}>
          <h2>Votre abonnement</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <article className="card">
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span className="badge">Plan actuel</span>
              <strong style={{ fontSize:18 }}>{plan}</strong>
            </div>
            <div className="text-sm" style={{ color:"#6b7280", marginTop:8 }}>
              Prochain prélèvement&nbsp;: <strong>{fmt(s?.nextPaymentAt)}</strong><br/>
              Expiration&nbsp;: <strong>{fmt(s?.expiresAt)}</strong><br/>
              Option Coaching+&nbsp;: <strong>{CPLUS[option]?.label || "—"}</strong><br/>
              Total mensuel&nbsp;: <strong>{total.toFixed(2).replace(".", ",")} €</strong>
            </div>
            {searchParams?.success && <div className="badge" style={{ marginTop:10 }}>Mise à jour enregistrée ✓</div>}
            {searchParams?.error && <div className="badge" style={{ marginTop:10 }}>Erreur&nbsp;: {searchParams.error}</div>}
          </article>

          <article className="card">
            <h3 style={{ marginTop:0, marginBottom:6 }}>Infos</h3>
            <ul style={{ margin:0, paddingLeft:18 }}>
              <li>Changement de plan immédiat dans l’app.</li>
              <li>Paiement réel non branché (démo).</li>
              <li>Vous pouvez changer/annuler à tout moment.</li>
            </ul>
          </article>
        </div>
      </section>

      {/* Choix des formules */}
      <section className="section" style={{ marginTop:12 }}>
        <div className="section-head" style={{ marginBottom:8 }}>
          <h2>Formules</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((p) => {
            const isCurrent = p.code === plan;
            return (
              <article key={p.code} className="card" style={{ display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
                <div>
                  <div className="flex items-center justify-between">
                    <h3 style={{ margin:0, fontSize:18, fontWeight:800 }}>{p.title}</h3>
                    <span className="badge">{p.code}</span>
                  </div>
                  <div className="text-sm" style={{ color:"#6b7280", marginTop:4 }}>{p.tagline}</div>
                  <div style={{ fontSize:28, fontWeight:800, marginTop:10 }}>{p.price}</div>

                  <ul style={{ marginTop:10, paddingLeft:18 }}>
                    {p.features.map((f) => <li key={f}>{f}</li>)}
                  </ul>

                  <div style={{ marginTop:12 }}>
                    <label className="label">Option Coaching+</label>
                    <select className="input" name="option" form={`form-${p.code}`} defaultValue={isCurrent ? (option || "none") : "none"}>
                      {Object.entries(CPLUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <div className="text-sm" style={{ color:"#6b7280", marginTop:6 }}>
                      Total indicatif: {p.price}
                    </div>
                  </div>
                </div>

                <form id={`form-${p.code}`} action={choosePlanAction} style={{ marginTop:12 }}>
                  <input type="hidden" name="plan" value={p.code} />
                  <button className="btn btn-dash" type="submit">
                    {isCurrent ? "Mettre à jour" : p.cta}
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
