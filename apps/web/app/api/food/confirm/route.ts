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

type ConfirmPlateBody = {
  kind: "plate";
  items: Array<{
    label: string;
    grams: number;
    kcal_per_100g: number;
    proteins_g_per_100g?: number | null;
  }>;
};

type ConfirmProductBody = {
  kind: "product";
  label: string;
  grams: number; // portion confirmée
  kcal_per_100g: number;
  proteins_g_per_100g?: number | null;
  source?: string;
  barcode?: string | null;
};

type ConfirmBody = ConfirmPlateBody | ConfirmProductBody;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as ConfirmBody | null;
    if (!body) return jsonError(400, "invalid_json");

    if (body.kind === "plate") {
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) return jsonError(400, "no_items");

      const clean = items
        .slice(0, 12)
        .map((it) => ({
          label: String(it.label || "aliment"),
          grams: Math.max(0, Number(it.grams || 0)),
          kcal_per_100g: Math.max(0, Number(it.kcal_per_100g || 0)),
          proteins_g_per_100g:
            it.proteins_g_per_100g != null ? Math.max(0, Number(it.proteins_g_per_100g)) : null,
        }))
        .filter((x) => x.grams > 0 && x.kcal_per_100g >= 0);

      if (!clean.length) return jsonError(400, "no_valid_items");

      const total_kcal = Math.round(
        clean.reduce((s, x) => s + (x.grams * x.kcal_per_100g) / 100, 0)
      );
      const protSum = clean.reduce(
        (s, x) => s + (x.grams * Number(x.proteins_g_per_100g || 0)) / 100,
        0
      );
      const total_proteins_g = Math.round(protSum * 10) / 10;

      return NextResponse.json(
        {
          kind: "plate",
          confirmed: true,
          items: clean,
          total_kcal,
          total_proteins_g,
        },
        { headers: { "Cache-Control": "no-store, no-transform" } }
      );
    }

    // product
    const grams = Math.max(0, Number(body.grams || 0));
    const kcal100 = Math.max(0, Number(body.kcal_per_100g || 0));
    const prot100 =
      body.proteins_g_per_100g != null ? Math.max(0, Number(body.proteins_g_per_100g)) : null;

    if (grams <= 0) return jsonError(400, "invalid_grams");
    if (kcal100 <= 0) return jsonError(400, "invalid_kcal_per_100g");

    const total_kcal = Math.round((grams * kcal100) / 100);
    const total_proteins_g =
      prot100 != null ? Math.round(((grams * prot100) / 100) * 10) / 10 : null;

    return NextResponse.json(
      {
        kind: "product",
        confirmed: true,
        label: String(body.label || "aliment"),
        grams,
        kcal_per_100g: kcal100,
        proteins_g_per_100g: prot100,
        total_kcal,
        total_proteins_g,
        source: body.source ?? null,
        barcode: body.barcode ?? null,
      },
      { headers: { "Cache-Control": "no-store, no-transform" } }
    );
  } catch (e: any) {
    return jsonError(500, e?.message || "internal_error");
  }
}
