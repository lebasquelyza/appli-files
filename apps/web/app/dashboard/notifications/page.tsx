import { PageHeader, Section } from "@/components/ui/Page";

export default function Page() {
  return (
    <>
      <PageHeader title="Notifications" subtitle="Motivation Files ou tes messages" />
      <Section title="Réglages">
        <div className="card">Bientôt: activer les rappels et messages personnalisés.</div>
      </Section>
    </>
  );
}
