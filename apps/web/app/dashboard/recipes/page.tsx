import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Plan = "BASIC" | "PLUS" | "PREMIUM";
type Rework = { ingredient: string; tips: string[] };
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
  rework?: Rework[];
};

/* ---------------- Utils ---------------- */
function planRank(p?: Plan) { return p === "PREMIUM" ? 3 : p === "PLUS" ? 2 : 1; }
function parseCsv(value?: string | string[]): string[] {
  const raw = Array.isArray(value) ? value.join(",") : value ?? "";
  return raw.split(/[,|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/* --- random déterministe --- */
function seededPRNG(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rand = seededPRNG(seed); const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pickRandomSeeded<T>(arr: T[], n: number, seed: number): T[] {
  return seededShuffle(arr, seed).slice(0, Math.max(0, Math.min(n, arr.length)));
}

/* ---- base64url JSON (Node + Edge + Browser safe) ---- */
function encodeB64UrlJson(data: any): string {
  const json = JSON.stringify(data);
  const B: any = (globalThis as any).Buffer;

  if (typeof window === "undefined" && B?.from) {
    return B.from(json, "utf8").toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/,"");
  }

  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const btoaFn: ((s: string) => string) | undefined = (globalThis as any).btoa;
  let b64: string;
  if (typeof btoaFn === "function") b64 = btoaFn(bin);
  else if (B?.from) b64 = B.from(bin, "binary").toString("base64");
  else b64 = "";
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/,"");
}

/* ---- dictionnaire "re-travailler" (fallback) ---- */
const REWORK_TIPS: Record<string, string[]> = {
  "brocoli": ["Rôti au four parmesan-citron", "Wok soja-sésame", "Velouté crème légère"],
  "saumon": ["Mariné miso/soja", "Papillote citron-aneth", "Rillettes au yaourt"],
  "tofu": ["Mariné puis snacké", "Panure maïzena + sauce douce", "Émietté façon brouillade"],
  "poivron": ["Confit puis pelé", "Coulis doux", "Grillé salade"],
  "champignons": ["Poêlés très chauds", "Hachés en bolo", "Rôtis entiers"],
  "courgette": ["Tagliatelles ail-citron", "Gratin ricotta-menthe", "Galettes râpées"],
  "épinards": ["Sautés minute", "Pesto doux", "Fondue légère"],
  "lentilles": ["Dal coco", "Salade tiède", "Soupe carotte-cumin"],
};

/* ---- base healthy (dispo pour tous) ---- */
type R = Recipe;
const HEALTHY_BASE: R[] = [
  { id:"salade-quinoa", title:"Salade de quinoa croquante", subtitle:"Pois chiches, concombre, citron",
    kcal:520, timeMin:15, tags:["végétarien","sans-gluten"], goals:["equilibre"], minPlan:"BASIC",
    ingredients:["quinoa","pois chiches","concombre","citron","huile d'olive","sel","poivre","persil"], steps:["Rincer, cuire, assaisonner"] },
  { id:"bowl-poulet-riz", title:"Bowl poulet & riz complet", subtitle:"Avocat, maïs, yaourt grec",
    kcal:640, timeMin:20, tags:["protéiné"], goals:["prise de masse","equilibre"], minPlan:"BASIC",
    ingredients:["poulet","riz complet","avocat","maïs","yaourt grec","cumin","citron","sel","poivre"], steps:["Cuire riz, saisir poulet, assembler"] },
  { id:"omelette-herbes", title:"Omelette champignons & fines herbes", subtitle:"Rapide du matin",
    kcal:420, timeMin:10, tags:["rapide","sans-gluten"], goals:["equilibre"], minPlan:"BASIC",
    ingredients:["œufs","champignons","ciboulette","beurre","sel","poivre","parmesan"], steps:["Battre, cuire, plier"] },
  { id:"saumon-four", title:"Saumon au four & légumes rôtis", subtitle:"Carottes, brocoli, citron",
    kcal:580, timeMin:25, tags:["omega-3","sans-gluten"], goals:["equilibre","santé"], minPlan:"BASIC",
    ingredients:["saumon","brocoli","carottes","citron","huile d'olive","ail","sel","poivre"], steps:["Préchauffer, rôtir, servir"] },
  { id:"curry-chiche", title:"Curry de pois chiches coco", subtitle:"Vegan & réconfortant",
    kcal:600, timeMin:30, tags:["vegan","sans-gluten"], goals:["equilibre"], minPlan:"BASIC",
    ingredients:["pois chiches","lait de coco","tomates concassées","oignon","ail","curry","riz basmati","sel"], steps:["Suer, mijoter, servir"] },
  { id:"tofu-brocoli-wok", title:"Tofu sauté au brocoli (wok)", subtitle:"Sauce soja-sésame",
    kcal:530, timeMin:15, tags:["vegan","rapide"], goals:["sèche","equilibre"], minPlan:"BASIC",
    ingredients:["tofu ferme","brocoli","sauce soja","ail","gingembre","graines de sésame","huile","maïzena"], steps:["Saisir, lier, napper"] },
];

/* ========= Mode IA pour PLUS/PREMIUM ========= */
async function generateAIRecipes({ plan, kcal, kcalMin, kcalMax, allergens, dislikes, count = 12 }:{
  plan: Plan; kcal?: number; kcalMin?: number; kcalMax?: number; allergens: string[]; dislikes: string[]; count?: number;
}): Promise<R[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];
  const constraints: string[] = [];
  if (typeof kcal === "number" && !isNaN(kcal) && kcal > 0) constraints.push(`- Viser ~${kcal} kcal par recette (±10%).`);
  else {
    const hasMin = typeof kcalMin === "number" && !isNaN(kcalMin) && kcalMin > 0;
    const hasMax = typeof kcalMax === "number" && !isNaN(kcalMax) && kcalMax > 0;
    if (hasMin && hasMax) constraints.push(`- Respecter une plage ${kcalMin}-${kcalMax} kcal.`);
    else if (hasMin) constraints.push(`- Minimum ${kcalMin} kcal.`);
    else if (hasMax) constraints.push(`- Maximum ${kcalMax} kcal.`);
  }
  if (allergens.length) constraints.push(`- Exclure strictement: ${allergens.join(", ")}.`);
  if (dislikes.length) constraints.push(`- Si un ingrédient non-aimé apparaît, ne pas le supprimer: proposer une section "rework".`);

  const prompt =
`Tu es un chef-nutritionniste. Renvoie UNIQUEMENT du JSON valide (pas de texte).
Utilisateur:
- Plan: ${plan}
- Allergènes/Intolérances: ${allergens.join(", ") || "aucun"}
- Aliments non aimés (à re-travailler): ${dislikes.join(", ") || "aucun"}
- Nombre de recettes: ${count}

Contraintes:
${constraints.join("\n")}

Schéma:
{ "recipes": Recipe[] }`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Tu parles français et tu réponds en JSON strict." },
          { role: "user", content: prompt },
        ],
      }),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    let payload: any = {};
    try { payload = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}"); } catch {}
    const arr: any[] = Array.isArray(payload?.recipes) ? payload.recipes : [];
    const seen = new Set<string>();
    const clean: R[] = arr.map((raw) => {
      const title = String(raw?.title ?? "").trim();
      const id = String(raw?.id || title || Math.random().toString(36).slice(2)).trim()
        .toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      const ingr = Array.isArray(raw?.ingredients) ? raw.ingredients.map((x: any) => String(x)) : [];
      const steps = Array.isArray(raw?.steps) ? raw.steps.map((x: any) => String(x)) : [];
      const rework = Array.isArray(raw?.rework)
        ? raw.rework.map((x: any) => ({ ingredient: String(x?.ingredient || "").toLowerCase(), tips: Array.isArray(x?.tips) ? x.tips.map((t: any) => String(t)) : [] }))
        : undefined;
      const minPlan: Plan = (plan === "PREMIUM" ? "PREMIUM" : "PLUS");
      return { id, title, subtitle: raw?.subtitle ? String(raw.subtitle) : undefined, kcal: typeof raw?.kcal === "number" ? raw.kcal : undefined,
        timeMin: typeof raw?.timeMin === "number" ? raw.timeMin : undefined, tags: Array.isArray(raw?.tags) ? raw.tags.map((t: any) => String(t)) : [],
        goals: Array.isArray(raw?.goals) ? raw.goals.map((g: any) => String(g)) : [], minPlan, ingredients: ingr, steps, rework } as R;
    }).filter((r) => {
      if (!r.title) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      const ingLow = r.ingredients.map(i => i.toLowerCase());
      if (allergens.some(a => ingLow.includes(a))) return false;
      return true;
    });
    return clean;
  } catch { return []; }
}

/* ---- fallback “personnalisation simple” si IA indisponible ---- */
function personalizeFallback({ base, kcal, kcalMin, kcalMax, allergens, dislikes, plan }:{
  base: R[]; kcal?: number; kcalMin?: number; kcalMax?: number; allergens: string[]; dislikes: string[]; plan: Plan;
}): R[] {
  let filtered = base.filter(r => {
    const ing = r.ingredients.map(i => i.toLowerCase());
    return !allergens.some(a => ing.includes(a));
  });
  if (typeof kcal === "number" && !isNaN(kcal) && kcal > 0) {
    const tol = Math.max(75, Math.round(kcal * 0.15));
    filtered = filtered.filter(r => typeof r.kcal === "number" && Math.abs((r.kcal || 0) - kcal) <= tol);
  } else {
    const hasMin = typeof kcalMin === "number" && !isNaN(kcalMin) && kcalMin > 0;
    const hasMax = typeof kcalMax === "number" && !isNaN(kcalMax) && kcalMax > 0;
    if (hasMin) filtered = filtered.filter(r => (r.kcal || 0) >= (kcalMin as number));
    if (hasMax) filtered = filtered.filter(r => (r.kcal || 0) <= (kcalMax as number));
  }
  const dislikesSet = new Set(dislikes);
  return filtered.map<R>(r => {
    const ingLower = r.ingredients.map(i => i.toLowerCase());
    const hits = [...dislikesSet].filter(d => ingLower.includes(d));
    const minPlan: Plan = (plan === "PREMIUM" ? "PREMIUM" : "PLUS");
    if (!hits.length) return { ...r, minPlan };
    const tips = hits.map(h => ({ ingredient: h, tips: REWORK_TIPS[h] ?? ["Changer la cuisson", "Assaisonnement différent", "Mixer/hacher pour texture"] }));
    return { ...r, minPlan, rework: tips };
  });
}

/** ---- Server Action ---- */
async function applyFiltersAction(formData: FormData): Promise<void> {
  "use server";
  // lazy import session (évite crash à l'import)
  let plan: Plan = "BASIC";
  try {
    const mod = await import("@/lib/session");
    const s: any = await mod.getSession().catch(() => ({}));
    plan = (s?.plan as Plan) || "BASIC";
  } catch { plan = "BASIC"; }

  const params = new URLSearchParams();
  (["kcal","kcalMin","kcalMax","allergens","dislikes"] as const).forEach((f) => {
    const val = (formData.get(f) ?? "").toString().trim();
    if (val) params.set(f, val);
  });
  params.set("rnd", String(Date.now()));

  if (plan === "BASIC") redirect("/dashboard/abonnement");
  redirect(`/dashboard/recipes?${params.toString()}`);
}

/* ---------------- Page ---------------- */
export default async function Page({ searchParams }:{
  searchParams?: { kcal?: string; kcalMin?: string; kcalMax?: string; allergens?: string; dislikes?: string; rnd?: string };
}) {
  // lazy import de la session
  let plan: Plan = "BASIC";
  try {
    const mod = await import("@/lib/session");
    const s: any = await mod.getSession().catch(() => ({}));
    plan = (s?.plan as Plan) || "BASIC";
  } catch { plan = "BASIC"; }

  // 🔒 Réserver la page aux PLUS/PREMIUM
  if (plan === "BASIC") {
    redirect("/dashboard/abonnement");
  }

  const kcal = Number(searchParams?.kcal ?? "");
  const kcalMin = Number(searchParams?.kcalMin ?? "");
  const kcalMax = Number(searchParams?.kcalMax ?? "");
  const allergens = parseCsv(searchParams?.allergens);
  const dislikes = parseCsv(searchParams?.dislikes);

  const hasKcalTarget = !isNaN(kcal) && kcal > 0;
  const hasKcalMin = !isNaN(kcalMin) && kcalMin > 0;
  const hasKcalMax = !isNaN(kcalMax) && kcalMax > 0;

  const healthy = HEALTHY_BASE;

  let personalized: R[] = [];
  const ai = await generateAIRecipes({
    plan, kcal: hasKcalTarget ? kcal : undefined, kcalMin: hasKcalMin ? kcalMin : undefined,
    kcalMax: hasKcalMax ? kcalMax : undefined, allergens, dislikes, count: 16,
  });
  personalized = ai.length ? ai : personalizeFallback({
    base: HEALTHY_BASE, kcal: hasKcalTarget ? kcal : undefined, kcalMin: hasKcalMin ? kcalMin : undefined,
    kcalMax: hasKcalMax ? kcalMax : undefined, allergens, dislikes, plan,
  });

  let relaxedNote: string | null = null;
  if (personalized.length === 0) {
    const relaxed = personalizeFallback({ base: HEALTHY_BASE, allergens, dislikes, plan });
    personalized = relaxed.length ? relaxed : HEALTHY_BASE.map(r => ({ ...r, minPlan: plan }));
    relaxedNote = relaxed.length
      ? "Ajustement automatique : contrainte calories relâchée (allergènes respectés)."
      : "Ajustement automatique : suggestions healthy compatibles avec vos contraintes.";
  }

  const seed = Number(searchParams?.rnd ?? "0") || 123456789;
  const healthyPick = pickRandomSeeded(healthy, 4, seed);
  const personalizedPick = pickRandomSeeded(personalized, 6, seed);

  const qsParts: string[] = [];
  if (hasKcalTarget) qsParts.push(`kcal=${kcal}`);
  if (hasKcalMin) qsParts.push(`kcalMin=${kcalMin}`);
  if (hasKcalMax) qsParts.push(`kcalMax=${kcalMax}`);
  if (allergens.length) qsParts.push(`allergens=${encodeURIComponent(allergens.join(","))}`);
  if (dislikes.length) qsParts.push(`dislikes=${encodeURIComponent(dislikes.join(","))}`);
  const baseQS = qsParts.length ? `?${qsParts.join("&")}` : "";
  const encode = (r: R) => `${baseQS}${baseQS ? "&" : "?"}data=${encodeB64UrlJson(r)}`;

  return (
    <div
      className="container"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 24px)", paddingBottom: 32 }}
    >
      <div className="page-header">
        <div>
          <h1 className="h1">Recettes</h1>
          <p className="lead">L’IA adapte aux calories, allergies et aliments à re-travailler.</p>
          {relaxedNote && (
            <div className="text-xs" style={{ color:"#6b7280", marginTop:8 }}>{relaxedNote}</div>
          )}
        </div>
        <div className="text-sm">
          Votre formule : <span className="badge" style={{ marginLeft: 6 }}>{plan}</span>
        </div>
      </div>

      {/* Healthy pour tous (conservé si tu veux les montrer aussi aux PLUS/PREMIUM) */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}><h2>Healthy (pour tous)</h2></div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {healthyPick.map((r) => <Card key={r.id} r={r} detailQS={encode(r)} />)}
        </div>
      </section>

      {/* Personnalisées IA */}
      <section className="section" style={{ marginTop: 12 }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <h2>Recettes personnalisées (IA)</h2>
        </div>
        {personalizedPick.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
            {personalizedPick.map((r) => <Card key={r.id} r={r} detailQS={encode(r)} />)}
          </div>
        ) : (
          <div className="card text-sm" style={{ color:"#6b7280" }}>
            Aucune recette correspondant exactement à vos filtres pour le moment.
            Essayez d’élargir la plage calorique ou de réduire les exclusions.
          </div>
        )}
      </section>
    </div>
  );
}

function Card({ r, detailQS }: { r: Recipe; detailQS: string; }) {
  const href = `/dashboard/recipes/${r.id}${detailQS}`;
  const ing = Array.isArray(r.ingredients) ? r.ingredients : [];
  const shown = ing.slice(0, 8);
  const more = Math.max(0, ing.length - shown.length);

  return (
    <article className="card" style={{ overflow: "hidden" }}>
      <div className="flex items-center justify-between">
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{r.title}</h3>
        <span className="badge">{r.minPlan}</span>
      </div>
      <div className="text-sm" style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {typeof r.kcal === "number" && <span className="badge">{r.kcal} kcal</span>}
        {typeof r.timeMin === "number" && <span className="badge">{r.timeMin} min</span>}
      </div>
      <div className="text-sm" style={{ marginTop: 10 }}>
        <strong>Ingrédients</strong>
        <ul style={{ margin: "6px 0 0 16px" }}>
          {shown.map((i, idx) => <li key={idx}>{i}</li>)}
          {more > 0 && <li>+ {more} autre(s)…</li>}
        </ul>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <a className="btn btn-dash" href={href}>Voir la recette</a>
      </div>
    </article>
  );
}
