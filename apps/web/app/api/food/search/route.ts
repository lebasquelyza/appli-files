// apps/web/app/api/food/search/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type Candidate = {
  label: string;
  kcal_per_100g: number;
  proteins_g_per_100g: number | null;
  source: "OFF" | "USDA" | "DICT" | "IA";
  details?: string;
};

const UA = { "user-agent": "files-coaching/1.0 (+https://files.coach)" };

function json(status: number, data: any) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "Cache-Control": "no-store" },
  });
}
const nn = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : undefined);

// =============== OFF (par nom) ===============
async function withTimeout<T>(p: Promise<T>, ms = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort("timeout"), ms);
  try {
    // @ts-ignore
    return await p;
  } finally {
    clearTimeout(t);
  }
}
async function fetchJSON(url: string) {
  const r = await withTimeout(fetch(url, { headers: UA, cache: "no-store" }));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
function makeOFFCandidate(p: any): Candidate | null {
  const kcal100 =
    p?.nutriments?.["energy-kcal_100g"] ??
    p?.nutriments?.energy_kcal_100g ??
    p?.nutriments?.energy_kcal_value;
  const prot100 = p?.nutriments?.["proteins_100g"];
  if (kcal100 == null && prot100 == null) return null;
  const label =
    p?.product_name ||
    p?.generic_name ||
    p?.brands ||
    p?.categories?.split(",")?.[0] ||
    "Produit OFF";
  return {
    label: String(label),
    kcal_per_100g: Math.round(nn(kcal100) ?? 0),
    proteins_g_per_100g: prot100 != null ? nn(prot100)! : null,
    source: "OFF",
    details: p?.brands ? `Marque: ${p.brands}` : undefined,
  };
}
async function searchOFF(query: string, limit = 15): Promise<Candidate[]> {
  const qs = encodeURIComponent(query);
  const urls = [
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${qs}&search_simple=1&action=process&json=1&page_size=${limit}&sort_by=unique_scans_n`,
    `https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${qs}&search_simple=1&action=process&json=1&page_size=${limit}&sort_by=unique_scans_n`,
    `https://world.openfoodfacts.org/api/v2/search?search_text=${qs}&page_size=${limit}&fields=${encodeURIComponent(
      [
        "product_name",
        "generic_name",
        "brands",
        "categories",
        "nutriments.energy-kcal_100g",
        "nutriments.proteins_100g",
      ].join(",")
    )}&sort_by=unique_scans_n`,
  ];
  const bag: Candidate[] = [];
  for (const u of urls) {
    try {
      const j = await fetchJSON(u);
      const arr: any[] = j?.products || j?.products || [];
      for (const p of arr) {
        const c = makeOFFCandidate(p);
        if (c) bag.push(c);
      }
    } catch {
      // ignore
    }
    if (bag.length >= limit) break;
  }
  return bag.slice(0, limit);
}

// =============== USDA (FoodData Central) ===============
/**
 * On lit en priorité les nutriments 1008 (Energy, kcal) et 1003 (Protein, g).
 * Pour Foundation / SR Legacy, les "amount" sont généralement par 100 g.
 * Si on détecte une portion en grammes, on re-échelonne vers 100 g.
 */
async function searchUSDA(query: string, limit = 15): Promise<Candidate[]> {
  const key = (process.env.FDC_API_KEY || "").trim();
  if (!key) return []; // sans clé on passe
  try {
    const u = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
      key
    )}&query=${encodeURIComponent(query)}&pageSize=${limit}&dataType=Survey%20(FNDDS),SR%20Legacy,Foundation`;
    const j = await fetchJSON(u);
    const out: Candidate[] = [];
    for (const f of j?.foods || []) {
      const name: string =
        f.description ||
        f.lowercaseDescription ||
        f.brandName ||
        f.foodCategory ||
        "Aliment USDA";
      let kcal = undefined as number | undefined;
      let prot = undefined as number | undefined;

      // Nutriments list
      const ns: any[] = f.foodNutrients || [];
      for (const n of ns) {
        const id = n.nutrientId ?? n.nutrient?.id;
        if (id === 1008 && kcal == null) kcal = nn(n.value ?? n.amount);
        if (id === 1003 && prot == null) prot = nn(n.value ?? n.amount);
      }

      // Recalage éventuel à 100 g si portion détectable
      // (par prudence on ne recalculera que si la portion est en g)
      if ((f.servingSizeUnit || "").toLowerCase() === "g" && nn(f.servingSize) && (kcal || prot)) {
        const g = nn(f.servingSize)!;
        const factor = g ? 100 / g : 1;
        if (kcal != null) kcal = kcal * factor;
        if (prot != null) prot = prot * factor;
      }

      if (kcal != null || prot != null) {
        out.push({
          label: String(name),
          kcal_per_100g: Math.round(kcal ?? 0),
          proteins_g_per_100g: prot != null ? Number(prot) : null,
          source: "USDA",
          details: f.brandName ? `Marque: ${f.brandName}` : undefined,
        });
      }
    }
    return out.slice(0, limit);
  } catch {
    return [];
  }
}

// =============== DICT simple / FR ===============
const DICT: Array<{ match: RegExp; cands: Candidate[] }> = [
  { match: /riz\s*basmati/i, cands: [
    { label: "Riz basmati (cuit)", kcal_per_100g: 130, proteins_g_per_100g: 3, source: "DICT" },
    { label: "Riz basmati (sec)",  kcal_per_100g: 360, proteins_g_per_100g: 10, source: "DICT" },
  ]},
  { match: /\briz\b/i, cands: [
    { label: "Riz blanc (cuit)", kcal_per_100g: 130, proteins_g_per_100g: 2.7, source: "DICT" },
  ]},
  { match: /p[âa]tes/i, cands: [
    { label: "Pâtes (cuites)", kcal_per_100g: 150, proteins_g_per_100g: 5, source: "DICT" },
  ]},
  { match: /poulet/i, cands: [
    { label: "Poulet (cuit)", kcal_per_100g: 165, proteins_g_per_100g: 31, source: "DICT" },
  ]},
  { match: /banane/i, cands: [
    { label: "Banane (crue)", kcal_per_100g: 89, proteins_g_per_100g: 1.1, source: "DICT" },
  ]},
];
function dictCandidates(q: string): Candidate[] {
  for (const d of DICT) if (d.match.test(q)) return d.cands;
  return [];
}

// =============== Estimation IA (ultime) ===============
async function estimateWithAI(q: string): Promise<Candidate | null> {
  const apiKey = (process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || "").trim();
  if (!apiKey) return null;
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "FRANÇAIS. Donne une estimation réaliste pour {kcal/100g, protéines/100g} de l'aliment décrit. Réponds STRICTEMENT: { label, kcal_per_100g, proteins_g_per_100g }" },
          { role: "user", content: [{ type: "text", text: q }] },
        ],
      }),
    });
    const txt = await resp.text();
    let wrapped: any = {}; try { wrapped = JSON.parse(txt)?.choices?.[0]?.message?.content } catch {}
    let val: any = {}; try { val = JSON.parse(wrapped) } catch { return null; }
    const kcal = Math.max(0, Math.round(Number(val?.kcal_per_100g || 0)));
    const prot = val?.proteins_g_per_100g != null ? Math.max(0, Number(val.proteins_g_per_100g)) : null;
    if (!kcal && prot == null) return null;
    return { label: String(val?.label || q), kcal_per_100g: kcal, proteins_g_per_100g: prot, source: "IA", details: "Estimation" };
  } catch {
    return null;
  }
}

// =============== Handler ===============
export async function POST(req: NextRequest) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) return json(415, { error: "JSON attendu" });

    const body = await req.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) return json(200, { candidates: [], meta: { status: "degraded", reason: "missing_query" } });

    // 1) OFF
    const off = await searchOFF(query).catch(() => []);
    // 2) USDA
    const usda = await searchUSDA(query).catch(() => []);
    // 3) DICT
    const dict = !off.length && !usda.length ? dictCandidates(query) : [];
    // 4) IA
    const ia = !off.length && !usda.length && !dict.length ? await estimateWithAI(query) : null;

    // Merge & dedupe
    const bag: Candidate[] = [...off, ...usda, ...dict, ...(ia ? [ia] : [])];
    const key = (c: Candidate) => `${c.label}::${c.kcal_per_100g}::${c.proteins_g_per_100g ?? -1}::${c.source}`;
    const map = new Map<string, Candidate>();
    for (const c of bag) if (!map.has(key(c))) map.set(key(c), c);
    const out = Array.from(map.values()).slice(0, 20);

    return json(200, { candidates: out, meta: { status: out.length ? "ok" : "degraded" } });
  } catch {
    return json(200, { candidates: [], meta: { status: "degraded" } });
  }
}
