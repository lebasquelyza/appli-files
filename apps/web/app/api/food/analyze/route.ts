// apps/web/app/api/food/analyze/route.ts
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

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error("timeout"), { status: 504 })), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

/** --- Image sanitize --- */
type SanitizeOk = { ok: true; url: string; kind: "https" | "data" };
type SanitizeErr = { ok: false; reason: "empty" | "blob_url" | "bad_base64" | "unsupported" };
type SanitizeResult = SanitizeOk | SanitizeErr;

function sanitizeImageInput(raw: string): SanitizeResult {
  const s = (raw || "").trim();
  if (!s) return { ok: false, reason: "empty" };
  if (/^blob:/i.test(s)) return { ok: false, reason: "blob_url" };
  if (/^https:\/\/.+/i.test(s)) return { ok: true, url: s, kind: "https" };

  const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(s);
  if (m) {
    const mime = m[1].toLowerCase().replace("jpg", "jpeg");
    const b64 = m[2].replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { ok: false, reason: "bad_base64" };
    if (b64.length > 10 * 1024 * 1024) return { ok: false, reason: "unsupported" };
    return { ok: true, url: `data:image/${mime};base64,${b64}`, kind: "data" };
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(s)) {
    const looksPng = s.startsWith("iVBORw0KGgo");
    const mime = looksPng ? "image/png" : "image/jpeg";
    return { ok: true, url: `data:${mime};base64,${s}`, kind: "data" };
  }

  return { ok: false, reason: "unsupported" };
}

/** --- Types nutrition /100g --- */
type NutrPer100 = {
  kcal_per_100g: number;
  proteins_g_per_100g: number | null;
  carbs_g_per_100g: number | null;
  fats_g_per_100g: number | null;
  fibers_g_per_100g: number | null;
  sugars_g_per_100g: number | null;
  salt_g_per_100g: number | null;
};

type Candidate = {
  label: string;
  source: "OFF" | "IA" | "DICT";
  details?: string;
  confidence?: number;
} & NutrPer100;

type PlateItemEstimated = {
  label: string;
  grams_estimated: number;
  source: "OFF" | "IA" | "DICT";
} & NutrPer100;

type FoodAnalysis =
  | {
      kind: "product";
      needs_user_confirmation: true;
      top: Candidate;
      candidates: Candidate[];
      barcode?: string | null;
      net_weight_g?: number | null;
      portion_estimated_g: number;
      warnings?: string[];
    }
  | {
      kind: "plate";
      needs_user_confirmation: true;
      items: PlateItemEstimated[];
      warnings?: string[];
    };

/** --- Mini DICT (secours) --- */
const DICT: Record<string, NutrPer100> = {
  "pain complet": {
    kcal_per_100g: 250,
    proteins_g_per_100g: 9,
    carbs_g_per_100g: 45,
    fats_g_per_100g: 4,
    fibers_g_per_100g: 7,
    sugars_g_per_100g: 4,
    salt_g_per_100g: 1.2,
  },
  "riz cuit": {
    kcal_per_100g: 130,
    proteins_g_per_100g: 2.7,
    carbs_g_per_100g: 28,
    fats_g_per_100g: 0.3,
    fibers_g_per_100g: 0.4,
    sugars_g_per_100g: 0.1,
    salt_g_per_100g: 0,
  },
  "jambon": {
    kcal_per_100g: 145,
    proteins_g_per_100g: 21,
    carbs_g_per_100g: 1,
    fats_g_per_100g: 6,
    fibers_g_per_100g: 0,
    sugars_g_per_100g: 1,
    salt_g_per_100g: 1.8,
  },
  "sauce roquefort": {
    kcal_per_100g: 300,
    proteins_g_per_100g: 6,
    carbs_g_per_100g: 6,
    fats_g_per_100g: 28,
    fibers_g_per_100g: 0,
    sugars_g_per_100g: 3,
    salt_g_per_100g: 1.5,
  },
};

function n(x: any): number | null {
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

/** --- OFF helpers --- */
async function fetchOFFByBarcode(barcode: string): Promise<Candidate | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const r = await fetch(url, { headers: { "user-agent": "files-coaching/1.0" } });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const p = j?.product;
  if (!p) return null;

  const nutr = p.nutriments || {};
  const label = p.product_name || p.generic_name || p.brands || "Produit OFF";

  const kcal100 = n(nutr["energy-kcal_100g"]) ?? 0;
  const prot100 = n(nutr["proteins_100g"]);
  const carbs100 = n(nutr["carbohydrates_100g"]);
  const fat100 = n(nutr["fat_100g"]);
  const fiber100 = n(nutr["fiber_100g"]);
  const sugar100 = n(nutr["sugars_100g"]);
  const salt100 =
    n(nutr["salt_100g"]) ??
    (n(nutr["sodium_100g"]) != null ? (n(nutr["sodium_100g"]) as number) * 2.5 : null);

  if (!kcal100 && prot100 == null && carbs100 == null && fat100 == null) return null;

  return {
    label,
    source: "OFF",
    details: p.brands ? `Marque: ${p.brands}` : undefined,
    kcal_per_100g: Math.max(0, Math.round(kcal100)),
    proteins_g_per_100g: prot100,
    carbs_g_per_100g: carbs100,
    fats_g_per_100g: fat100,
    fibers_g_per_100g: fiber100,
    sugars_g_per_100g: sugar100,
    salt_g_per_100g: salt100,
  };
}

async function searchOFFByName(q: string): Promise<Candidate[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
    q
  )}&search_simple=1&action=process&json=1&page_size=5`;
  const r = await fetch(url, { headers: { "user-agent": "files-coaching/1.0" } });
  if (!r.ok) return [];
  const j = await r.json().catch(() => null);

  const out: Candidate[] = [];
  for (const p of j?.products ?? []) {
    const nutr = p.nutriments || {};
    const kcal100 = n(nutr["energy-kcal_100g"]) ?? 0;
    const prot100 = n(nutr["proteins_100g"]);
    const carbs100 = n(nutr["carbohydrates_100g"]);
    const fat100 = n(nutr["fat_100g"]);
    const fiber100 = n(nutr["fiber_100g"]);
    const sugar100 = n(nutr["sugars_100g"]);
    const salt100 =
      n(nutr["salt_100g"]) ??
      (n(nutr["sodium_100g"]) != null ? (n(nutr["sodium_100g"]) as number) * 2.5 : null);

    const name =
      p.product_name || p.generic_name || p.brands || p.categories?.split(",")?.[0] || q;

    if (kcal100 || prot100 != null || carbs100 != null || fat100 != null) {
      out.push({
        label: String(name),
        source: "OFF",
        details: p.brands ? `Marque: ${p.brands}` : undefined,
        kcal_per_100g: Math.max(0, Math.round(kcal100)),
        proteins_g_per_100g: prot100,
        carbs_g_per_100g: carbs100,
        fats_g_per_100g: fat100,
        fibers_g_per_100g: fiber100,
        sugars_g_per_100g: sugar100,
        salt_g_per_100g: salt100,
      });
    }
  }
  return out;
}

/** --- Vision IA (produit vs assiette) --- */
async function analyzeWithVision(imageDataUrl: string, apiKey: string) {
  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system",
        content:
          "FRANÇAIS UNIQUEMENT.\n" +
          "1) Dire si c'est une ASSIETTE (plusieurs aliments) ou un PRODUIT unique.\n" +
          "2) Si PRODUIT: extraire name, barcode (si lisible), net_weight_g (si visible).\n" +
          "3) Si ASSIETTE: lister les principaux éléments ET SÉPARER sauces/condiments/huiles.\n" +
          "4) Si le texte est illisible, NE PAS inventer une marque/nom précis: rester générique (ex: 'pain complet', 'pain', 'riz').\n" +
          "JSON uniquement.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Renvoie STRICTEMENT un JSON UNION:\n" +
              "CAS_A: { kind:'product', name:string, barcode:string|null, net_weight_g:number|null }\n" +
              "CAS_B: { kind:'plate', items:[{ label:string, grams:number }...] }\n" +
              "Max 8 items, inclure sauces/condiments si présents.",
          },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });

  const txt = await resp.text().catch(() => "");
  if (!resp.ok) {
    let parsed: any = null;
    try {
      parsed = JSON.parse(txt);
    } catch {}
    const msg = parsed?.error?.message || txt || `HTTP ${resp.status}`;
    const err: any = new Error(msg);
    err.status = resp.status;
    throw err;
  }

  let content: any;
  try {
    content = JSON.parse(txt)?.choices?.[0]?.message?.content;
  } catch {}

  let out: any;
  try {
    out = JSON.parse(content);
  } catch {
    throw Object.assign(new Error("non_json"), { status: 502 });
  }
  return out;
}

/** --- Densify assiette (macros /100g) --- */
async function densifyPlateItems(items: Array<{ label: string; grams: number }>, apiKey: string) {
  const payload = {
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system",
        content:
          "FRANÇAIS. Pour chaque élément, donner des valeurs réalistes PAR 100g.\n" +
          "Répond STRICTEMENT: { items:[{ label, kcal_per_100g, proteins_g_per_100g, carbs_g_per_100g, fats_g_per_100g, fibers_g_per_100g, sugars_g_per_100g, salt_g_per_100g }] }.\n" +
          "Sauces/condiments/huiles: valeurs typiques (souvent plus gras/salé).",
      },
      { role: "user", content: [{ type: "text", text: JSON.stringify({ items }, null, 2) }] },
    ],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });

  const txt = await resp.text().catch(() => "");
  let content: any = {};
  try {
    content = JSON.parse(txt)?.choices?.[0]?.message?.content;
  } catch {}
  try {
    content = JSON.parse(content);
  } catch {
    content = { items: [] };
  }
  return content?.items || [];
}

/** --- Densify produit (fallback) --- */
async function densifySingleFood(label: string, apiKey: string): Promise<Candidate> {
  const payload = {
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system",
        content:
          "FRANÇAIS. Donne une estimation nutritionnelle réaliste PAR 100g.\n" +
          "Répond STRICTEMENT: { label, kcal_per_100g, proteins_g_per_100g, carbs_g_per_100g, fats_g_per_100g, fibers_g_per_100g, sugars_g_per_100g, salt_g_per_100g }",
      },
      { role: "user", content: [{ type: "text", text: label || "aliment" }] },
    ],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });

  const txt = await resp.text().catch(() => "");
  let content: any = {};
  try {
    content = JSON.parse(txt)?.choices?.[0]?.message?.content;
  } catch {}
  try {
    content = JSON.parse(content);
  } catch {
    content = {};
  }

  const toN = (x: any) => (x == null ? null : Number(x));
  return {
    label: String(content?.label || label || "aliment"),
    source: "IA",
    details: "Estimation IA",
    confidence: 0.6,
    kcal_per_100g: Math.max(0, Math.round(Number(content?.kcal_per_100g || 0))),
    proteins_g_per_100g: toN(content?.proteins_g_per_100g) != null ? Math.max(0, Number(content.proteins_g_per_100g)) : null,
    carbs_g_per_100g: toN(content?.carbs_g_per_100g) != null ? Math.max(0, Number(content.carbs_g_per_100g)) : null,
    fats_g_per_100g: toN(content?.fats_g_per_100g) != null ? Math.max(0, Number(content.fats_g_per_100g)) : null,
    fibers_g_per_100g: toN(content?.fibers_g_per_100g) != null ? Math.max(0, Number(content.fibers_g_per_100g)) : null,
    sugars_g_per_100g: toN(content?.sugars_g_per_100g) != null ? Math.max(0, Number(content.sugars_g_per_100g)) : null,
    salt_g_per_100g: toN(content?.salt_g_per_100g) != null ? Math.max(0, Number(content.salt_g_per_100g)) : null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = (process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || "").trim();
    if (!apiKey) return jsonError(400, "missing_OPENAI_API_KEY");

    const ct = (req.headers.get("content-type") || "").toLowerCase();
    let imageDataUrl = "";

    if (ct.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      const raw = typeof body.image === "string" ? body.image : "";
      const s = sanitizeImageInput(raw);
      if (!s.ok) return jsonError(400, `invalid_image:${s.reason}`);
      imageDataUrl = s.url;
    } else if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("image");
      if (!(file instanceof File)) return jsonError(400, "no_image");
      const bytes = Buffer.from(await file.arrayBuffer());
      const base64 = bytes.toString("base64");
      const mime = file.type || "image/jpeg";
      imageDataUrl = `data:${mime};base64,${base64}`;
    } else {
      return jsonError(
        415,
        "Unsupported Media Type. Envoyer multipart/form-data (image) ou JSON { image }."
      );
    }

    const vision = await withTimeout(analyzeWithVision(imageDataUrl, apiKey), 25_000);

    /** ===== PLATE ===== */
    if (vision?.kind === "plate" && Array.isArray(vision.items)) {
      const rawItems = (vision.items as any[])
        .map((x) => ({ label: String(x?.label || "").trim(), grams: Number(x?.grams || 0) }))
        .filter((x) => x.label)
        .slice(0, 8);

      const dens = await densifyPlateItems(rawItems, apiKey);

      const outItems: PlateItemEstimated[] = rawItems.map((it) => {
        const low = it.label.toLowerCase();
        const dictEntry = Object.entries(DICT).find(([k]) => low.includes(k))?.[1];

        const densMatch = (dens || []).find(
          (d: any) => String(d?.label || "").toLowerCase() === low
        );

        const base: NutrPer100 =
          dictEntry ?? {
            kcal_per_100g: Number(densMatch?.kcal_per_100g || 0),
            proteins_g_per_100g: densMatch?.proteins_g_per_100g != null ? Number(densMatch.proteins_g_per_100g) : null,
            carbs_g_per_100g: densMatch?.carbs_g_per_100g != null ? Number(densMatch.carbs_g_per_100g) : null,
            fats_g_per_100g: densMatch?.fats_g_per_100g != null ? Number(densMatch.fats_g_per_100g) : null,
            fibers_g_per_100g: densMatch?.fibers_g_per_100g != null ? Number(densMatch.fibers_g_per_100g) : null,
            sugars_g_per_100g: densMatch?.sugars_g_per_100g != null ? Number(densMatch.sugars_g_per_100g) : null,
            salt_g_per_100g: densMatch?.salt_g_per_100g != null ? Number(densMatch.salt_g_per_100g) : null,
          };

        return {
          label: it.label,
          grams_estimated: Math.max(1, Math.round(it.grams || 0)),
          source: dictEntry ? "DICT" : "IA",
          kcal_per_100g: Math.max(0, Math.round(Number(base.kcal_per_100g || 0))),
          proteins_g_per_100g: base.proteins_g_per_100g != null ? Math.max(0, Number(base.proteins_g_per_100g)) : null,
          carbs_g_per_100g: base.carbs_g_per_100g != null ? Math.max(0, Number(base.carbs_g_per_100g)) : null,
          fats_g_per_100g: base.fats_g_per_100g != null ? Math.max(0, Number(base.fats_g_per_100g)) : null,
          fibers_g_per_100g: base.fibers_g_per_100g != null ? Math.max(0, Number(base.fibers_g_per_100g)) : null,
          sugars_g_per_100g: base.sugars_g_per_100g != null ? Math.max(0, Number(base.sugars_g_per_100g)) : null,
          salt_g_per_100g: base.salt_g_per_100g != null ? Math.max(0, Number(base.salt_g_per_100g)) : null,
        };
      });

      const warnings: string[] = [];
      warnings.push("Quantités estimées sur photo : merci de confirmer le grammage.");
      if (outItems.some((x) => /riz|p[âa]tes|poulet|b[œo]uf|saumon/i.test(x.label))) {
        warnings.push("Vérifie cru/cuit : les valeurs changent beaucoup.");
      }
      if (outItems.some((x) => /sauce|roquefort|huile|mayo|cr[èe]me/i.test(x.label))) {
        warnings.push("Sauces/huile : souvent sous-estimées, ajuste si besoin.");
      }

      const payload: FoodAnalysis = {
        kind: "plate",
        needs_user_confirmation: true,
        items: outItems.slice(0, 8),
        warnings,
      };
      return NextResponse.json(payload, { headers: { "Cache-Control": "no-store, no-transform" } });
    }

    /** ===== PRODUCT ===== */
    const rawLabel = String(vision?.name || "").trim();
    const label = rawLabel || "aliment";
    const barcode =
      vision?.barcode && /^\d{8,14}$/.test(String(vision.barcode)) ? String(vision.barcode) : null;
    const netWeight =
      Number(vision?.net_weight_g || 0) > 0 ? Math.round(Number(vision?.net_weight_g)) : null;

    const warnings: string[] = [];
    warnings.push("Portion estimée : merci de confirmer le grammage avant calcul.");

    // 1) Si barcode => OFF fiable
    if (barcode) {
      const off = await fetchOFFByBarcode(barcode).catch(() => null);
      if (off) {
        const payload: FoodAnalysis = {
          kind: "product",
          needs_user_confirmation: true,
          top: off,
          candidates: [off],
          barcode,
          net_weight_g: netWeight,
          portion_estimated_g: netWeight && netWeight > 0 ? netWeight : 250,
          warnings,
        };
        return NextResponse.json(payload, { headers: { "Cache-Control": "no-store, no-transform" } });
      }
      warnings.push("Code-barres détecté mais produit introuvable sur OFF.");
    }

    // 2) Sinon: on propose des candidats OFF mais on NE les met PAS en top
    const offCandidates = label ? await searchOFFByName(label).catch(() => []) : [];
    const topCandidates = offCandidates.slice(0, 3);

    // 3) top = IA/DICT (générique) pour éviter les faux positifs
    const dictEntry = Object.entries(DICT).find(([k]) => label.toLowerCase().includes(k))?.[1];
    const top =
      dictEntry
        ? ({
            label: label,
            source: "DICT",
            details: "Dictionnaire local (générique)",
            confidence: 0.75,
            ...dictEntry,
          } as Candidate)
        : await densifySingleFood(label, apiKey);

    const candidates: Candidate[] = [top, ...topCandidates].slice(0, 3);

    if (topCandidates.length) {
      warnings.push(
        "Produit non certain (pas de code-barres) : choisis un candidat ou scanne le code-barres."
      );
    } else {
      warnings.push("Produit non reconnu sur OFF (sans code-barres) : estimation générique.");
    }

    const payload: FoodAnalysis = {
      kind: "product",
      needs_user_confirmation: true,
      top: candidates[0],
      candidates,
      barcode: null,
      net_weight_g: netWeight,
      portion_estimated_g: netWeight && netWeight > 0 ? netWeight : 250,
      warnings,
    };
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store, no-transform" } });
  } catch (e: any) {
    const status = e?.status ?? e?.response?.status ?? 500;
    return jsonError(status, e?.message || "internal_error");
  }
}
