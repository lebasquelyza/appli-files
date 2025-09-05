import { getSession, updateProfile } from "@/lib/session";
import { PageHeader, Section } from "@/components/ui/Page";

const plans = [
  { key:"BASIC", name:"Basic", price:"9,90 €", features:["Chatbot","Recettes générales","Suivi progrès","Motivation"] },
  { key:"PLUS", name:"Plus", price:"19,90 €", features:["Tout Basic","Recettes personnalisées","3 séances IA","-50% sur la 1ère visio"] },
  { key:"PREMIUM", name:"Premium", price:"39,90 €", features:["Tout Plus","Accès intégral au site","Correction vidéo exos","+ 1 visio offerte à l'achat"] },
] as const;

const options = [
  { name:"1 visio/mois avec coach", price:"+20 €" },
  { name:"1 séance réelle", price:"+40 €" },
  { name:"Pack 4 séances réelles/mois", price:"+140 €" },
  { name:"Pack 8 séances réelles/mois", price:"+240 €" },
];

export default function Page(){
  const s = getSession();
  return (
    <>
      <PageHeader title="Tarifs" subtitle="Choisis le plan qui te convient" />
      <Section title="Abonnements">
        <div className="grid md:grid-cols-3 gap-4">
          {plans.map(p=> (
            <form action={updateProfile} key={p.key} className={"card space-y-3 " + (s?.plan===p.key ? "ring-2" : "")} style={s?.plan===p.key?{boxShadow:"0 0 0 2px var(--ring)"}:{}}>
              <input type="hidden" name="plan" value={p.key} />
              <div className="text-xl font-semibold">{p.name}</div>
              <div className="text-3xl font-bold">{p.price}/mois</div>
              <ul className="text-sm list-disc pl-5 space-y-1" style={{color:"#111"}}>
                {p.features.map((f,i)=><li key={i}>{f}</li>)}
              </ul>
              <button className="btn w-full" type="submit">{s?.plan===p.key?"Plan actuel":"Choisir"}</button>
            </form>
          ))}
        </div>
      </Section>

      <Section title="Option Coaching+">
        <ul className="grid sm:grid-cols-2 gap-2">
          {options.map((o,i)=>(
            <li key={i} className="card flex items-center justify-between">
              <span>{o.name}</span><b>{o.price}</b>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
