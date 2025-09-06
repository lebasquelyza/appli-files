import { PageHeader, Section } from "@/components/ui/Page";

export default function Page() {
  return (
    <>
      <PageHeader title="Recettes" subtitle="Idées healthy" />
      <Section title="Suggestions">
        <ul className="grid sm:grid-cols-2 gap-6" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          <li className="card">Poke bowl saumon</li>
          <li className="card">Salade quinoa</li>
          <li className="card">Poulet grillé + légumes</li>
          <li className="card">Overnight oats</li>
        </ul>
      </Section>
    </>
  );
}
