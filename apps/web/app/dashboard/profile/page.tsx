import { getSession, updateProfile } from "@/lib/session";
import { PageHeader, Section } from "@/components/ui/Page";

export default function Page() {
  const s = getSession();

  return (
    <div className="container">
      {/* En-tête conforme au design système */}
      <PageHeader
        title="Mon profil"
        subtitle="Photo, identité et formule d’abonnement"
        className="page-header"
      />

      {/* Bloc d'informations avec styles `.section` */}
      <Section title="Informations" className="section">
        <form action={updateProfile} className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="w-full">
              <label className="label">Nom affiché</label>
              <input
                name="name"
                className="input"
                defaultValue={s?.name || ""}
                placeholder="Jane Doe"
              />
            </div>

            <div className="w-full">
              <label className="label">Formule</label>
              <select
                name="plan"
                className="input"
                defaultValue={s?.plan || "BASIC"}
              >
                <option value="BASIC">Basic</option>
                <option value="PLUS">Plus</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </div>

            <div className="lg:col-span-2 w-full">
              <label className="label">Photo (URL)</label>
              <input
                name="image"
                className="input"
                defaultValue={s?.image || ""}
                placeholder="https://…"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">&nbsp;</span>
            <button className="btn btn-dash">Enregistrer</button>
          </div>
        </form>
      </Section>
    </div>
  );
}
