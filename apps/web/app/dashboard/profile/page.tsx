import { getSession, updateProfile } from "@/lib/session";
import { PageHeader, Section } from "@/components/ui/Page";

export default function Page() {
  const s = getSession();

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <PageHeader title="Mon profil" subtitle="Photo, identité et formule d’abonnement" />

      <Section title="Informations">
        {/* wrapper pour appliquer le style .section sans toucher à Section */}
        <div className="section" style={{ marginTop: 12 }}>
          <form action={updateProfile} className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Prénom */}
              <div className="w-full">
                <label className="label">Prénom</label>
                <input name="firstName" className="input" defaultValue={(s as any)?.firstName || ""} placeholder="Jane" />
              </div>

              {/* Nom de famille */}
              <div className="w-full">
                <label className="label">Nom</label>
                <input name="lastName" className="input" defaultValue={(s as any)?.lastName || ""} placeholder="Doe" />
              </div>
            </div>

            {/* Abonnement en cours */}
            <div className="card" style={{ marginTop: 8 }}>
              <div className="section-head" style={{ marginBottom: 8 }}>
                <h2>Abonnement</h2>
                <span className="badge">Actif</span>
              </div>

              <SubscriptionSummary session={s} />
            </div>

            <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
              <span className="text-sm" />
              <button className="btn btn-dash" type="submit">Enregistrer</button>
            </div>
          </form>
        </div>
      </Section>
    </div>
  );
}

function SubscriptionSummary({ session }: { session: any }) {
  const plan = session?.plan ?? "BASIC";
  const nextChargeAt = session?.nextChargeAt || session?.subscription?.nextChargeAt || session?.billing?.nextChargeAt;
  const expiresAt = session?.expiresAt || session?.subscription?.expiresAt || session?.billing?.periodEndsAt;

  const fmt = (d?: string) => {
    if (!d) return "—";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  };

  const planLabel = { BASIC: "Basic", PLUS: "Plus", PREMIUM: "Premium" }[plan as "BASIC" | "PLUS" | "PREMIUM"] || String(plan);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <div className="text-sm" style={{ color: "#6b7280" }}>Formule en cours</div>
        <div className="h1 text-3xl" style={{ fontSize: 20, marginTop: 4 }}>{planLabel}</div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <div className="text-sm" style={{ color: "#6b7280" }}>Prochain prélèvement</div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>{fmt(nextChargeAt)}</div>
        </div>
        <div>
          <div className="text-sm" style={{ color: "#6b7280" }}>Date d’expiration</div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>{fmt(expiresAt)}</div>
        </div>
      </div>
    </div>
  );
}
