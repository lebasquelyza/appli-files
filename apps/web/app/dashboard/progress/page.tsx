import { PageHeader, Section } from "@/components/ui/Page";

export default function Page() {
  return (
    <>
      <PageHeader title="Mes progrès" subtitle="Historique et mises à jour" />
      <Section title="Entrées récentes">
        <div className="card">Pas encore de données — à connecter plus tard à Google Sheets.</div>
      </Section>
    </>
  );
}
