import { PageHeader, Section } from "@/components/ui/Page";

export default function Page(){
  return (
    <>
      <PageHeader title="Connecte tes données" subtitle="Relie des apps santé ou importe tes fichiers" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Apps">
          <ul className="space-y-2">
            <li className="card flex items-center justify-between">
              <div><b>Apple Santé</b><div className="text-sm" style={{color:"#6b7280"}}>iOS (app native)</div></div>
              <button className="btn-outline" disabled>Indisponible Web</button>
            </li>
            <li className="card flex items-center justify-between">
              <div><b>Google Fit</b><div className="text-sm" style={{color:"#6b7280"}}>OAuth — à brancher</div></div>
              <button className="btn-outline">Connecter</button>
            </li>
            <li className="card flex items-center justify-between">
              <div><b>Importer un CSV</b><div className="text-sm" style={{color:"#6b7280"}}>Pas de compte requis</div></div>
              <a className="btn-outline" href="#">Importer</a>
            </li>
          </ul>
        </Section>
        <Section title="Confidentialité">
          <p className="text-sm" style={{color:"#6b7280"}}>Nous ne partageons jamais vos données sans consentement.</p>
        </Section>
      </div>
    </>
  );
}
