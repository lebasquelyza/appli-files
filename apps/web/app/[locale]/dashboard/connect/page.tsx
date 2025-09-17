import { PageHeader, Section } from "@/components/ui/Page";

export default function Page() {
  return (
    <>
      <PageHeader title="Connecte tes données" subtitle="Santé, capteurs, etc." />
      <Section title="Intégrations">
        <div className="card">À venir: Apple Santé, Google Fit…</div>
      </Section>
    </>
  );
}
