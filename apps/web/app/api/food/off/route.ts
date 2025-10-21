// apps/web/app/api/food/off/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

function jsonError(status: number, msg: string) {
  return new NextResponse(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json", "Cache-Control": "no-store" },
  });
}

type Candidate = {
  label: string;
  kcal_per_100g: number;
  proteins_g_per_100g: number | null;
  source: "OFF";
  details?: string;
};

const UA = { "user-agent": "files-coaching/1.0 (+https://files.coach)" };

/** Helpers communs */
function normNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function makeCandidate(p: any): Candidate | null {
  if (!p) return null;
  const kcal100 = p.nutriments?.["energy-kcal_100g"] ?? p.nutriments?.energy_kcal_100g ?? p.nutriments?.energy_kcal_value;
  const prot100 = p.nutriments?.["proteins_100g"];
  const label =
    p.product_name ||
    p.generic_name ||
    p.brands ||
    p.categories?.split(",")?.[0] ||
    p._keywords?.[0] ||
    "Produit OFF";

  if (kcal100 == null && prot100 == null) return null;

  return {
    label: String(label),
    kcal_per_100g: Math.round(normNum(kcal100) ?? 0),
    proteins_g_per_100g: prot100 != null ? normNum(prot100)! : null,
    source: "OFF",
    details: p.brands ? `Marque: ${p.brands}` : undefined,
  };
}

/** Requêtes OFF */
async function fetchByBarcode(barcode: string): Promise<Candidate | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const r = await fetch(url, { headers: UA, cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return makeCandidate(j?.product) || null;
}

async function searchPl(domain: "world" | "fr", q: string, size = 20): Promise<Candidate[]> {
  const url = `https://${domain}.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${size}&sort_by=unique_scans_n`;
  const r = await fetch(url, { headers: UA, cache: "no-store" });
  if (!r.ok) return [];
  const j = await r.json().catch(() => null);
  const arr = (j?.products || []) as any[];
  const out: Candidate[] = [];
  for (const p of arr) {
    const c = makeCandidate(p);
    if (c) out.push(c);
  }
  return out;
}

async function searchV2(domain: "world" | "fr", q: string, size = 20): Promise<Candidate[]> {
  const fields = [
    "product_name",
    "generic_name",
    "brands",
    "categories",
    "nutriments.energy-kcal_100g",
    "nutriments.proteins_100g",
  ].join(",");
  const url = `https://${domain}.openfoodfacts.org/api/v2/search?search_text=${encodeURIComponent(q)}&page_size=${size}&fields=${encodeURIComponent(fields)}&sort_by=unique_scans_n`;
  const r = await fetch(url, { headers: UA, cache: "no-store" });
  if (!r.ok) return [];
  const j = await r.json().catch(() => null);
  const arr = (j?.products || []) as any[];
  const out: Candidate[] = [];
  for (const p of arr) {
    const c = makeCandidate(p);
    if (c) out.push(c);
  }
  return out;
}

/** Traductions simples FR→EN si 0 résultat */
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

/** Handler */
export async function POST(req: NextRequest) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) return jsonError(415, "JSON attendu");

    const body = await req.json().catch(() => ({}));
    const barcode = typeof body.barcode === "string" ? body.barcode.trim() : "";
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!barcode && !query) return jsonError(400, "barcode ou query requis");

    // 1) Barcode direct
    if (barcode) {
      const one = await fetchByBarcode(barcode);
      return NextResponse.json({ candidates: one ? [one] : [] }, { headers: { "Cache-Control": "no-store" } });
    }

    // 2) Recherche par nom — on tente plusieurs variantes/domains/endpoints
    const queries = translateQueryIfNeeded(query);
    const bag: Candidate[] = [];

    for (const q of queries) {
      // world + fr, search.pl puis api v2
      const r1 = await searchPl("world", q);
      bag.push(...r1);
      if (bag.length >= 5) break;

      const r2 = await searchPl("fr", q);
      bag.push(...r2);
      if (bag.length >= 5) break;

      const r3 = await searchV2("world", q);
      bag.push(...r3);
      if (bag.length >= 5) break;

      const r4 = await searchV2("fr", q);
      bag.push(...r4);
      if (bag.length >= 5) break;
    }

    // Déduplique grossièrement par (label,kcal,prot)
    const key = (c: Candidate) => `${c.label}::${c.kcal_per_100g}::${c.proteins_g_per_100g ?? -1}`;
    const uniqMap = new Map<string, Candidate>();
    for (const c of bag) if (!uniqMap.has(key(c))) uniqMap.set(key(c), c);
    const uniq = Array.from(uniqMap.values()).slice(0, 10);

    return NextResponse.json({ candidates: uniq }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return jsonError(500, e?.message || "internal_error");
  }
}

