import { PageHeader, Section } from "@/components/ui/Page";
export default function Page(){
  return (
    <>
      <PageHeader title="Réglages" subtitle="Préférences de l’application" />
      <Section title="Général">
        <div className="card">Bientôt: langue, thème…</div>
      </Section>
    </>
  );
}
