export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Plan = "BASIC" | "PLUS" | "PREMIUM";
type Recipe = {
  id: string;
  title: string;
  subtitle?: string;
  kcal?: number;
  timeMin?: number;
  tags: string[];
  goals: string[];
  minPlan: Plan;
  ingredients: string[];
  steps: string[];
};

/* --- random déterministe --- */
function seededPRNG(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rand = seededPRNG(seed); const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ---- base64url JSON (Node + Browser safe) ---- */
function encodeB64UrlJson(data: any): string {
  const json = JSON.stringify(data);
  if (typeof window === "undefined") {
    // @ts-ignore Buffer dispo côté Node
    return Buffer.from(json, "utf8").toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/,"");
  } else {
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/,"");
  }
}

/* ---- Fallback statique ---- */
function sampleRecipes(count = 12): Recipe[] {
  const samples: Recipe[] = [
    { id:"salade-quinoa", title:"Salade de quinoa croquante", subtitle:"Pois chiches, concombre, citron",
      kcal:520, timeMin:15, tags:["végétarien","sans-gluten"], goals:["equilibre"], minPlan:"BASIC",
      ingredients:["quinoa","pois chiches","concombre","citron","huile d'olive","sel","poivre","persil"], steps:["1. Rincer le quinoa","2. Couper les légumes","3. Assaisonner"] },
    { id:"bowl-poulet-riz", title:"Bowl poulet & riz complet", subtitle:"Avocat, maïs, yaourt grec",
      kcal:640, timeMin:20, tags:["riche-protéines"], goals:["prise de masse","equilibre"], minPlan:"BASIC",
      ingredients:["poulet","riz complet","avocat","maïs","yaourt grec","cumin","citron","sel","poivre"], steps:["1. Cuire le riz","2. Saisir le poulet","3. Assembler"] },
    { id:"omelette-champignons", title:"Omelette champignons & fines herbes", subtitle:"Rapide du matin",
      kcal:420, timeMin:10, tags:["rapide","sans-gluten"], goals:["equilibre"], minPlan:"BASIC",
      ingredients:["œufs","champignons","ciboulette","beurre","sel","poivre","parmesan"], steps:["1. Battre les œufs","2. Cuire","3. Plier"] },
    { id:"saumon-four", title:"Saumon au four & légumes rôtis", subtitle:"Carottes, brocoli, citron",
      kcal:580, timeMin:25, tags:["omega-3","sans-gluten"], goals:["equilibre","santé"], minPlan:"BASIC",
      ingredients:["saumon","brocoli","carottes","citron","huile d'olive","ail","sel","poivre"], steps:["1. Préchauffer","2. Rôtir","3. Servir"] },
  ];
  const seed = 123456789;
  return seededShuffle(samples, seed).slice(0, Math.min(count, samples.length));
}

export default async function Page() {
  const recipes = sampleRecipes(8);

  const encode = (r: Recipe) => {
    const b64url = encodeB64UrlJson(r);
    return `?data=${b64url}`;
  };

  return (
    <div className="container" style={{ padding: 24 }}>
      <div className="page-header">
        <h1 className="h1" style={{ margin: 0 }}>Recettes</h1>
        <p className="lead" style={{ marginTop: 6, color: "#6b7280" }}>
          Version clean, sans dépendances — cliquez pour voir une fiche recette.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2" style={{ marginTop: 16 }}>
        {recipes.map((r) => {
          const detailQS = encode(r);
          return (
            <article key={r.id} className="card" style={{ overflow: "hidden" }}>
              <div className="flex items-center justify-between">
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{r.title}</h3>
                {typeof r.kcal === "number" && <span className="badge">{r.kcal} kcal</span>}
              </div>
              {r.subtitle && <p className="text-sm" style={{ color: "#6b7280", marginTop: 4 }}>{r.subtitle}</p>}

              <div className="text-sm" style={{ marginTop: 8 }}>
                <strong>Ingrédients</strong>
                <ul style={{ margin: "6px 0 0 16px" }}>
                  {r.ingredients.slice(0, 6).map((i, idx) => <li key={idx}>{i}</li>)}
                  {r.ingredients.length > 6 && <li>+ {r.ingredients.length - 6} autre(s)…</li>}
                </ul>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <a className="btn btn-dash" href={`/dashboard/recipes/${r.id}${detailQS}`}>Voir la recette</a>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
