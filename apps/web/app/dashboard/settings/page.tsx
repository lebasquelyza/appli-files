import { PageHeader, Section } from "@/components/ui/Page";

export default function Page(){
  return (
    <>
      <PageHeader title="Réglages" subtitle="Thème, confidentialité et préférences" />
      <Section title="Apparence">
        <div className="card flex items-center justify-between">
          <div>
            <div className="font-medium">Thème</div>
            <div className="text-sm" style={{color:"#6b7280"}}>Couleurs partagées web & mobile</div>
          </div>
          <a className="btn-outline" href="#">Modifier variables</a>
        </div>
      </Section>
      <Section title="Données">
        <div className="card flex items-center justify-between">
          <div>
            <div className="font-medium">Confidentialité</div>
            <div className="text-sm" style={{color:"#6b7280"}}>Gestion des données</div>
          </div>
          <a className="btn-outline" href="/dashboard/connect">Ouvrir</a>
        </div>
      </Section>
    </>
  );
}
