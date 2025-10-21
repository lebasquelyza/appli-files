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

async function fetchOFFByBarcode(barcode: string): Promise<Candidate | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const r = await fetch(url, { headers: { "user-agent": "files-coaching/1.0" }, cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const p = j?.product;
  if (!p) return null;
  const kcal100 = p.nutriments?.["energy-kcal_100g"];
  const prot100 = p.nutriments?.["proteins_100g"];
  const name = p.product_name || p.generic_name || p.brands || "Produit OFF";
  if (kcal100 == null && prot100 == null) return null;
  return {
    label: String(name),
    kcal_per_100g: Math.round(Number(kcal100 ?? 0)),
    proteins_g_per_100g: prot100 != null ? Number(prot100) : null,
    source: "OFF",
    details: p.brands ? `Marque: ${p.brands}` : undefined,
  };
}

async function searchOFFByName(q: string): Promise<Candidate[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=5`;
  const r = await fetch(url, { headers: { "user-agent": "files-coaching/1.0" }, cache: "no-store" });
  if (!r.ok) return [];
  const j = await r.json().catch(() => null);
  const out: Candidate[] = [];
  for (const p of j?.products ?? []) {
    const kcal100 = p.nutriments?.["energy-kcal_100g"];
    const prot100 = p.nutriments?.["proteins_100g"];
    const name = p.product_name || p.generic_name || p.brands || p.categories?.split(",")?.[0] || q;
    if (kcal100 != null || prot100 != null) {
      out.push({
        label: String(name),
        kcal_per_100g: Math.round(Number(kcal100 ?? 0)),
        proteins_g_per_100g: prot100 != null ? Number(prot100) : null,
        source: "OFF",
        details: p.brands ? `Marque: ${p.brands}` : undefined,
      });
    }
  }
  return out.slice(0, 5);
}

export async function POST(req: NextRequest) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) return jsonError(415, "JSON attendu");

    const body = await req.json().catch(() => ({}));
    const barcode = typeof body.barcode === "string" ? body.barcode.trim() : "";
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!barcode && !query) return jsonError(400, "barcode ou query requis");

    if (barcode) {
      const one = await fetchOFFByBarcode(barcode);
      return NextResponse.json({ candidates: one ? [one] : [] }, { headers: { "Cache-Control": "no-store" } });
    } else {
      const list = await searchOFFByName(query);
      return NextResponse.json({ candidates: list }, { headers: { "Cache-Control": "no-store" } });
    }
  } catch (e: any) {
    return jsonError(500, e?.message || "internal_error");
  }
}
