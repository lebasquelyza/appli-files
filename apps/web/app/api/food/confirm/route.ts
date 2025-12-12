// apps/web/app/api/food/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

function jsonError(status: number, msg: string) {
  return new NextResponse(JSON.stringify({ error: msg }), {
    status,
    headers: {
      "content-type": "application/json",
      "Cache-Control": "no-store, no-transform",
    },
  });
}

type NutrPer100 = {
  kcal_per_100g: number;
  proteins_g_per_100g: number | null;
  carbs_g_per_100g: number | null;
  fats_g_per_100g: number | null;
  fibers_g_per_100g: number | null;
  sugars_g_per_100g: number | null;
  salt_g_per_100g: number | null;
};

type ConfirmPlateBody = {
  kind: "plate";
  items: Array<{ label: string; grams: number } & NutrPer100>;
};

type ConfirmProductBody = {
  kind: "product";
  label: string;
  grams: number;
} & NutrPer100 & { source?: string; barcode?: string | null };

type ConfirmBody = ConfirmPlateBody | ConfirmProductBody;

function sumMacro(items: Array<{ grams: number } & NutrPer100>) {
  const mul = (g: number, v: number | null) => (v == null ? 0 : (g * v) / 100);

  const totals = {
    total_kcal: 0,
    total_proteins_g: 0,
    total_carbs_g: 0,
    total_fats_g: 0,
    total_fibers_g: 0,
    total_sugars_g: 0,
    total_salt_g: 0,
  };

  for (const it of items) {
    const g = Math.max(0, Number(it.grams || 0));
    totals.total_kcal += (g * Math.max(0, Number(it.kcal_per_100g || 0))) / 100;
    totals.total_proteins_g += mul(g, it.proteins_g_per_100g);
    totals.total_carbs_g += mul(g, it.carbs_g_per_100g);
    totals.total_fats_g += mul(g, it.fats_g_per_100g);
    totals.total_fibers_g += mul(g, it.fibers_g_per_100g);
    totals.total_sugars_g += mul(g, it.sugars_g_per_100g);
    totals.total_salt_g += mul(g, it.salt_g_per_100g);
  }

  return {
    total_kcal: Math.round(totals.total_kcal),
    total_proteins_g: Math.round(totals.total_proteins_g * 10) / 10,
    total_carbs_g: Math.round(totals.total_carbs_g * 10) / 10,
    total_fats_g: Math.round(totals.total_fats_g * 10) / 10,
    total_fibers_g: Math.round(totals.total_fibers_g * 10) / 10,
    total_sugars_g: Math.round(totals.total_sugars_g * 10) / 10,
    total_salt_g: Math.round(totals.total_salt_g * 100) / 100, // sel en g, 2 décimales
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as ConfirmBody | null;
    if (!body) return jsonError(400, "invalid_json");

    if (body.kind === "plate") {
      const items = (body.items || [])
        .slice(0, 12)
        .map((it) => ({
          ...it,
          label: String(it.label || "aliment"),
          grams: Math.max(0, Number(it.grams || 0)),
          kcal_per_100g: Math.max(0, Number(it.kcal_per_100g || 0)),
          proteins_g_per_100g: it.proteins_g_per_100g != null ? Math.max(0, Number(it.proteins_g_per_100g)) : null,
          carbs_g_per_100g: it.carbs_g_per_100g != null ? Math.max(0, Number(it.carbs_g_per_100g)) : null,
          fats_g_per_100g: it.fats_g_per_100g != null ? Math.max(0, Number(it.fats_g_per_100g)) : null,
          fibers_g_per_100g: it.fibers_g_per_100g != null ? Math.max(0, Number(it.fibers_g_per_100g)) : null,
          sugars_g_per_100g: it.sugars_g_per_100g != null ? Math.max(0, Number(it.sugars_g_per_100g)) : null,
          salt_g_per_100g: it.salt_g_per_100g != null ? Math.max(0, Number(it.salt_g_per_100g)) : null,
        }))
        .filter((x) => x.grams > 0);

      if (!items.length) return jsonError(400, "no_items");

      const totals = sumMacro(items);

      return NextResponse.json(
        { kind: "plate", confirmed: true, items, ...totals },
        { headers: { "Cache-Control": "no-store, no-transform" } }
      );
    }

    // product
    const grams = Math.max(0, Number(body.grams || 0));
    if (grams <= 0) return jsonError(400, "invalid_grams");

    const totals = sumMacro([body as any]);

    return NextResponse.json(
      {
        kind: "product",
        confirmed: true,
        label: String(body.label || "aliment"),
        grams,
        source: body.source ?? null,
        barcode: body.barcode ?? null,
        ...totals,
      },
      { headers: { "Cache-Control": "no-store, no-transform" } }
    );
  } catch (e: any) {
    return jsonError(500, e?.message || "internal_error");
  }
}
