import { PageHeader, Section } from "@/components/ui/Page";

export default function Page() {
  return (
    <>
      <PageHeader title="Bienvenue 👋" subtitle="Exos simples, recettes et météo locale" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Exercices simples">
          <ul className="grid sm:grid-cols-2 gap-6" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <li className="card">20 squats lents</li>
            <li className="card">3×30″ planche</li>
            <li className="card">2′ mobilité hanches</li>
            <li className="card">Marche 10′</li>
          </ul>
        </Section>
        <Section title="Idées recettes">
          <ul className="grid sm:grid-cols-2 gap-6" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <li className="card">Omelette épinards</li>
            <li className="card">Yaourt grec + fruits</li>
            <li className="card">Poulet + riz + brocoli</li>
            <li className="card">Bowl quinoa</li>
          </ul>
        </Section>
      </div>
    </>
  );
}
