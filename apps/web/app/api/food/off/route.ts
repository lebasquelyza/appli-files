// apps/web/app/api/food/off/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type Candidate = {
  label: string;
  kcal_per_100g: number;
  proteins_g_per_100g: number | null;
  source: "OFF" | "DICT";
  details?: string;
};

const UA = { "user-agent": "files-coaching/1.0 (+https://files.coach)" };

function json(status: number, data: any) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "Cache-Control": "no-store" },
  });
}
function normNum(v: any) { const n = Number(v); return Number.isFinite(n) ? n : undefined; }
function makeCandidate(p: any): Candidate | null {
  if (!p) return null;
  const kcal100 = p.nutriments?.["energy-kcal_100g"] ?? p.nutriments?.energy_kcal_100g ?? p.nutriments?.energy_kcal_value;
  const prot100 = p.nutriments?.["proteins_100g"];
  const label =
    p.product_name || p.generic_name || p.brands || p.categories?.split(",")?.[0] || p._keywords?.[0] || "Produit OFF";
  if (kcal100 == null && prot100 == null) return null;
  return {
    label: String(label),
    kcal_per_100g: Math.round(normNum(kcal100) ?? 0),
    proteins_g_per_100g: prot100 != null ? normNum(prot100)! : null,
    source: "OFF",
    details: p.brands ? `Marque: ${p.brands}` : undefined,
  };
}

// Dictionnaire de secours (FR, réaliste)
const DICT: Record<string, Candidate[]> = {
  "riz basmati": [
    { label: "Riz basmati (cuit)", kcal_per_100g: 130, proteins_g_per_100g: 3, source: "DICT" },
    { label: "Riz basmati (sec)", kcal_per_100g: 360, proteins_g_per_100g: 10, source: "DICT" },
  ],
  "riz": [
    { label: "Riz blanc (cuit)", kcal_per_100g: 130, proteins_g_per_100g: 2.7, source: "DICT" },
  ],
  "pâtes": [
    { label: "Pâtes (cuites)", kcal_per_100g: 150, proteins_g_per_100g: 5, source: "DICT" },
  ],
  "poulet": [
    { label: "Poulet (cuit)", kcal_per_100g: 165, proteins_g_per_100g: 31, source: "DICT" },
  ],
};

function dictCandidates(q: string): Candidate[] {
  const lower = q.toLowerCase();
  for (const key of Object.keys(DICT)) {
    if (lower.includes(key)) return DICT[key];
  }
  return [];
}

async function withTimeout<T>(p: Promise<T>, ms = 7000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort("timeout"), ms);
  try {
    // @ts-ignore
    return await p;
  } finally { clearTimeout(t); }
}

async function fetchJSON(url: string) {
  const r = await withTimeout(fetch(url, { headers: UA, cache: "no-store" }));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function fetchByBarcode(barcode: string): Promise<Candidate | null> {
  try {
    const j = await fetchJSON(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
    return makeCandidate(j?.product) || null;
  } catch { return null; }
}

async function searchPl(domain: "world" | "fr", q: string, size = 20): Promise<Candidate[]> {
  try {
    const j = await fetchJSON(
      `https://${domain}.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${size}&sort_by=unique_scans_n`
    );
    const arr = (j?.products || []) as any[];
    const out: Candidate[] = [];
    for (const p of arr) { const c = makeCandidate(p); if (c) out.push(c); }
    return out;
  } catch { return []; }
}

async function searchV2(domain: "world" | "fr", q: string, size = 20): Promise<Candidate[]> {
  try {
    const fields = [
      "product_name", "generic_name", "brands", "categories",
      "nutriments.energy-kcal_100g", "nutriments.proteins_100g",
    ].join(",");
    const j = await fetchJSON(
      `https://${domain}.openfoodfacts.org/api/v2/search?search_text=${encodeURIComponent(q)}&page_size=${size}&fields=${encodeURIComponent(fields)}&sort_by=unique_scans_n`
    );
    const arr = (j?.products || []) as any[];
    const out: Candidate[] = [];
    for (const p of arr) { const c = makeCandidate(p); if (c) out.push(c); }
    return out;
  } catch { return []; }
}

function translateQueryIfNeeded(q: string): string[] {
  const base = q.trim();
  const lower = base.toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/^riz basmati$/, "basmati rice"],
    [/^riz jasmine$/, "jasmine rice"],
    [/^riz$/, "rice"],
    [/poulet/g, "chicken"],
    [/boeuf|bœuf/g, "beef"],
    [/saumon/g, "salmon"],
    [/yaourt/g, "yogurt"],
    [/fromage/g, "cheese"],
  ];
  let en = lower;
  for (const [re, rep] of map) en = en.replace(re, rep);
  const uniq = Array.from(new Set([base, en])).filter(Boolean);
  return uniq;
}

export async function POST(req: NextRequest) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) return json(415, { error: "JSON attendu" });

    const body = await req.json().catch(() => ({}));
    const barcode = typeof body.barcode === "string" ? body.barcode.trim() : "";
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!barcode && !query) return json(400, { error: "barcode ou query requis" });

    // 1) Barcode → OK/KO mais on répond 200
    if (barcode) {
      const one = await fetchByBarcode(barcode);
      return json(200, { candidates: one ? [one] : [], meta: { status: one ? "ok" : "empty" } });
    }

    // 2) Recherche par nom avec multi-endpoints + traduction
    const queries = translateQueryIfNeeded(query);
    const bag: Candidate[] = [];
    let degraded = false;

    try {
      for (const q of queries) {
        for (const fn of [
          () => searchPl("world", q),
          () => searchPl("fr", q),
          () => searchV2("world", q),
          () => searchV2("fr", q),
        ]) {
          const list = await fn();
          if (list.length) bag.push(...list);
          if (bag.length >= 10) break;
        }
        if (bag.length >= 10) break;
      }
    } catch {
      degraded = true;
    }

    // Déduplique
    const key = (c: Candidate) => `${c.label}::${c.kcal_per_100g}::${c.proteins_g_per_100g ?? -1}`;
    const uniqMap = new Map<string, Candidate>();
    for (const c of bag) if (!uniqMap.has(key(c))) uniqMap.set(key(c), c);
    let uniq = Array.from(uniqMap.values()).slice(0, 10);

    // Fallback dictionnaire si rien
    if (!uniq.length) {
      const dict = dictCandidates(query);
      if (dict.length) {
        uniq = dict;
        degraded = true;
      }
    }

    return json(200, { candidates: uniq, meta: { status: degraded ? "degraded" : "ok" } });
  } catch {
    // Jamais 500 côté client : on renvoie un 200 "degraded" avec aucun résultat
    return json(200, { candidates: [], meta: { status: "degraded" } });
  }
}
