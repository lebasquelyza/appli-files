import { PageHeader, Section } from "@/components/ui/Page";

export default function Page() {
  return (
    <>
      <PageHeader title="Tarifs" subtitle="Basic, Plus, Premium" />
      <Section title="Formules">
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="card"><b>Basic</b><br/>Recettes + Minuteur</div>
          <div className="card"><b>Plus</b><br/>Basic + Personnalisation</div>
          <div className="card"><b>Premium</b><br/>Plus + IA correction</div>
        </div>
      </Section>
    </>
  );
}
