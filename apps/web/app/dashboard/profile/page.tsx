import { getSession, updateProfile } from "@/lib/session";
import { PageHeader, Section } from "@/components/ui/Page";

export default function Page() {
  const s = getSession();
  return (
    <>
      <PageHeader title="Mon profil" subtitle="Photo, identité et formule d’abonnement" />
      <Section title="Informations">
        <form action={updateProfile} className="space-y-4">
          <div>
            <label className="label">Nom affiché</label>
            <input name="name" className="input" defaultValue={s?.name||""} />
          </div>
          <div>
            <label className="label">Photo (URL)</label>
            <input name="image" className="input" defaultValue={s?.image||""} placeholder="https://…" />
          </div>
          <div>
            <label className="label">Formule</label>
            <select name="plan" className="input" defaultValue={s?.plan||"BASIC"}>
              <option value="BASIC">Basic</option>
              <option value="PLUS">Plus</option>
              <option value="PREMIUM">Premium</option>
            </select>
          </div>
          <button className="btn">Enregistrer</button>
        </form>
      </Section>
    </>
  );
}
