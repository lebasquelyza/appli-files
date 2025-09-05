import { getSession } from "@/lib/session";
import { PageHeader, Section } from "@/components/ui/Page";

const all = [
  { title: "Porridge protéiné", kcal: 420, plan: "BASIC" },
  { title: "Salade poulet avocat", kcal: 520, plan: "PLUS" },
  { title: "Bowl saumon & quinoa", kcal: 600, plan: "PREMIUM" },
] as const;

export default function Page() {
  const s = getSession();
  const rank = (p:string)=> p==="BASIC"?0:p==="PLUS"?1:2;
  const unlocked = all.filter(r=>rank(r.plan)<=rank(s?.plan||"BASIC"));
  const locked = all.filter(r=>!unlocked.includes(r));

  return (
    <>
      <PageHeader title="Recettes" subtitle="Healthy, et débloquées selon ton plan" />
      <div className="grid md:grid-cols-2 gap-6">
        <Section title="Accessibles">
          <div className="grid sm:grid-cols-2 gap-3">
            {unlocked.map((r,i)=>(
              <div className="card" key={i}>
                <div className="font-medium">{r.title}</div>
                <div className="text-sm" style={{color:"#6b7280"}}>{r.kcal} kcal</div>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Plus avec l’abonnement">
          <div className="grid sm:grid-cols-2 gap-3">
            {locked.map((r,i)=>(
              <div className="card" key={i} style={{opacity:.7}}>
                <div className="font-medium">{r.title}</div>
                <div className="text-sm" style={{color:"#6b7280"}}>{r.kcal} kcal</div>
                <a className="cta" href="/dashboard/pricing" style={{marginTop:10, display:"inline-block"}}>Passer au plan supérieur</a>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}
