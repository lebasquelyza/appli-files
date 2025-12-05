// apps/web/app/dashboard/abonnement/page.tsx
import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { stripe } from "@/lib/stripe";
import { PRICE_IDS } from "@/lib/price-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Plan = "BASIC" | "PLUS" | "PREMIUM";

type PlanCard = {
  code: Plan;
  title: string;
  priceEUR: number;
  tagline: string;
  features: string[];
  cta: string;
  recommended?: boolean;
};

const PLANS: PlanCard[] = [
  {
    code: "BASIC",
    title: "Basic",
    priceEUR: 9.90,
    tagline: "Recettes + Minuteur",
    features: ["Recettes générales", "Minuteur d’exercices", "Support par email"],
    cta: "Choisir Basic",
  },
  {
    code: "PLUS",
    title: "Plus",
    priceEUR: 19.90,
    tagline: "Basic + Personnalisation",
    features: [
      "Recettes personnalisées (IA)",
      "Filtres avancés (allergènes, régimes)",
      "Historique & favoris",
    ],
    cta: "Choisir Plus",
    recommended: true,
  },
  {
    code: "PREMIUM",
    title: "Premium",
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

const CPLUS = {
  none: { label: "Sans option Coaching+", extra: 0 },
  visio1: { label: "1 visio/mois avec coach (+20 €)", extra: 20 },
  real1: { label: "1 séance réelle/mois (+40 €)", extra: 40 },
  real4: { label: "Pack 4 séances réelles/mois (+140 €)", extra: 140 },
  real8: { label: "Pack 8 séances réelles/mois (+240 €)", extra: 240 },
} as const;
type CPlusKey = keyof typeof CPLUS;

function eur(n: number, suffix = " € / mois") {
  return `${n.toFixed(2).replace(".", ",")}${suffix}`;
}
function fmt(dateISO?: string | null) {
  if (!dateISO) return "—";
  try {
    return new Date(dateISO).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

/** Server Action: choisir/mettre à jour le plan -> crée la session Stripe Checkout et redirige vers Stripe */
async function choosePlanAction(formData: FormData) {
  "use server";
  const plan = (formData.get("plan") || "").toString().toUpperCase() as Plan;
  const option = (formData.get("option") || "none").toString() as CPlusKey;

  if (!["BASIC", "PLUS", "PREMIUM"].includes(plan))
    redirect("/dashboard/abonnement?error=plan_invalide");
  if (!(option in CPLUS))
    redirect("/dashboard/abonnement?error=option_invalide");

  // (facultatif) récupérer ta session applicative
  let s: any = {};
  try {
    s = await getSession();
  } catch {}

  const origin =
    process.env.APP_URL ||
    headers().get("origin") ||
    "http://localhost:3000";

  // Pas de blocage/validation côté code : on caste directement
  const planPrice = PRICE_IDS[plan] as string;
  const addOn = (PRICE_IDS.CPLUS as any)[option] as
    | string
    | null
    | undefined;

  const line_items: Array<{ price: string; quantity: number }> = [
    { price: planPrice, quantity: 1 },
  ];
  if (addOn) line_items.push({ price: addOn, quantity: 1 });

  // Laisse Stripe décider des moyens de paiement activés (pas de payment_method_types ici)
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items,
    allow_promotion_codes: true,
    success_url: `${origin}/dashboard/abonnement/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/abonnement?canceled=1`,
    metadata: {
      plan,
      option,
      appUserId: s?.userId || "",
    },
    // customer: s?.stripeCustomerId || undefined,
  });

  redirect(session.url!);
}

export default async function Page({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string };
}) {
  // 🔒 Feature flag : page cachée tant que la variable n'est pas à "true"
  const enabled = process.env.NEXT_PUBLIC_ENABLE_SUBSCRIPTION === "true";
  if (!enabled) {
    notFound(); // renvoie une 404 propre
  }

  const s: any = await getSession().catch(() => ({}));
  const plan: Plan = (s?.plan as Plan) || "BASIC";
  const option: CPlusKey = (s?.coachingOption as CPlusKey) || "none";

  const basePrice = PLANS.find((p) => p.code === plan)?.priceEUR ?? 0;
  const total =
    typeof s?.monthlyTotalEUR === "number"
      ? s.monthlyTotalEUR
      : basePrice + (CPLUS[option]?.extra ?? 0);

  return (
    <div
      className="container"
      style={{
        paddingTop: 24,
        paddingBottom: 32,
        fontSize: "var(--settings-fs, 12px)",
      }}
    >
      {/* Titre principal */}
      <div className="page-header">
        <div>
          <h1 className="h1" style={{ fontSize: 22 }}>
            Abonnements
          </h1>
        </div>
      </div>

      {/* Bandeau compact en haut */}
      <section className="section" style={{ marginTop: 0 }}>
        <div
          className="card"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <h2
              style={{ margin: 0, fontSize: 18, fontWeight: 800 }}
            >
              Abonnement & Tarifs
            </h2>
            <div
              className="text-sm"
              style={{ marginTop: 6, color: "#6b7280" }}
            >
              Choisissez la formule qui vous convient et activez
              Coaching+ si besoin.
              <br />
              Les changements s’appliquent immédiatement dans l’app
              (démo&nbsp;: sans paiement réel).
            </div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            Plan actuel :{" "}
            <span className="badge" style={{ marginLeft: 6 }}>
              {plan}
            </span>
          </div>
        </div>
      </section>

      {/* Alerts */}
      {!!searchParams?.success && (
        <div
          className="card"
          style={{
            border: "1px solid rgba(16,185,129,.35)",
            background: "rgba(16,185,129,.08)",
            marginBottom: 12,
            fontWeight: 600,
          }}
        >
          ✅ Mise à jour enregistrée.
        </div>
      )}
      {!!searchParams?.error && (
        <div
          className="card"
          style={{
            border: "1px solid rgba(239,68,68,.35)",
            background: "rgba(239,68,68,.08)",
            marginBottom: 12,
            fontWeight: 600,
          }}
        >
          ⚠️ Erreur : {searchParams.error}
        </div>
      )}

      {/* État abonnement */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Votre abonnement</h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <span className="badge">Plan actif</span>
              <strong style={{ fontSize: 18 }}>{plan}</strong>
            </div>
            <div
              className="text-sm"
              style={{ color: "#6b7280", lineHeight: 1.8 }}
            >
              Prochain prélèvement&nbsp;:{" "}
              <strong style={{ color: "#111" }}>
                {fmt(s?.nextPaymentAt)}
              </strong>
              <br />
              Expiration&nbsp;:{" "}
              <strong style={{ color: "#111" }}>
                {fmt(s?.expiresAt)}
              </strong>
              <br />
              Option Coaching+&nbsp;:{" "}
              <strong style={{ color: "#111" }}>
                {CPLUS[option]?.label || "—"}
              </strong>
              <br />
              Total mensuel&nbsp;:{" "}
              <strong style={{ color: "#111" }}>
                {eur(total, " €")}
              </strong>
            </div>
          </article>

          <article className="card">
            <h3
              style={{
                marginTop: 0,
                marginBottom: 6,
              }}
            >
              Ce que vous obtenez
            </h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                lineHeight: 1.7,
              }}
            >
              <li>
                <b>Basic</b> : Recettes healthy + minuteur d’exercices.
              </li>
              <li>
                <b>Plus</b> : IA recettes personnalisées (calories,
                allergènes), historique & favoris.
              </li>
              <li>
                <b>Premium</b> : Plans hebdo IA + correction vidéo +
                support prioritaire.
              </li>
              <li>
                <b>Coaching+</b> : Visio/séances réelles en supplément
                au mois.
              </li>
            </ul>
          </article>
        </div>
      </section>

      {/* Choix des formules */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Formules</h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((p) => {
            const isCurrent = p.code === plan;
            const defaultOption: CPlusKey = isCurrent
              ? option || "none"
              : "none";
            const totalIndicatif =
              p.priceEUR + (CPLUS[defaultOption]?.extra ?? 0);

            return (
              <article
                key={p.code}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  border: p.recommended
                    ? "1px solid rgba(16,185,129,.35)"
                    : "1px solid rgba(0,0,0,0.06)",
                  boxShadow: p.recommended ? "var(--shadow)" : "none",
                  minHeight: 320,
                }}
              >
                {/* Rubans */}
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    display: "flex",
                    gap: 8,
                  }}
                >
                  {p.recommended && (
                    <span className="badge">Recommandé</span>
                  )}
                  {isCurrent && (
                    <span className="badge">Actif</span>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 18,
                        fontWeight: 800,
                      }}
                    >
                      {p.title}
                    </h3>
                  </div>
                  <div
                    className="text-sm"
                    style={{
                      color: "#6b7280",
                      marginTop: 4,
                    }}
                  >
                    {p.tagline}
                  </div>

                  {/* Prix */}
                  <div
                    style={{
                      fontSize: 30,
                      fontWeight: 900,
                      marginTop: 10,
                      letterSpacing: 0.2,
                    }}
                  >
                    {eur(p.priceEUR)}
                  </div>

                  {/* Features */}
                  <ul
                    style={{
                      marginTop: 10,
                      paddingLeft: 18,
                      lineHeight: 1.7,
                    }}
                  >
                    {p.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>

                  {/* Option Coaching+ */}
                  <div style={{ marginTop: 12 }}>
                    <label
                      className="label"
                      style={{
                        display: "block",
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Option Coaching+
                    </label>
                    <select
                      className="input"
                      name="option"
                      form={`form-${p.code}`}
                      defaultValue={defaultOption}
                      style={{
                        width: "100%",
                        background: "#ffffff",
                        color: "#111827",
                        border: "1px solid #d1d5db",
                        WebkitTextFillColor: "#111827" as any,
                        caretColor: "#111827",
                      }}
                    >
                      {Object.entries(CPLUS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <div
                      className="text-sm"
                      style={{
                        color: "#6b7280",
                        marginTop: 6,
                      }}
                    >
                      Total indicatif :{" "}
                      <b style={{ color: "#111" }}>
                        {eur(totalIndicatif)}
                      </b>
                    </div>
                  </div>
                </div>

                {/* CTA principal */}
                <form
                  id={`form-${p.code}`}
                  action={choosePlanAction}
                  style={{ marginTop: 16 }}
                >
                  <input type="hidden" name="plan" value={p.code} />
                  <button
                    className="btn btn-dash"
                    type="submit"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      fontWeight: 800,
                    }}
                  >
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
