// apps/web/app/api/food/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";

/** Next runtime */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

/** Utils génériques */
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

/** Image sanitize */
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

/** Types nutrition /100g */
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
      net_weight_g?: number | null;
      barcode?: string | null;
      portion_estimated_g: number;
      warnings?: string[];
    }
  | {
      kind: "plate";
      needs_user_confirmation: true;
      items: PlateItemEstimated[];
      warnings?: string[];
    };

/** Helpers */
function toNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function clamp0(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}
function clampNull0(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}
function normLabel(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * DICT local de secours (valeurs moyennes /100g).
 * Tu peux l’étendre facilement.
 */
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
  "pain": {
    kcal_per_100g: 260,
    proteins_g_per_100g: 9,
    carbs_g_per_100g: 50,
    fats_g_per_100g: 3.5,
    fibers_g_per_100g: 3,
    sugars_g_per_100g: 4,
    salt_g_per_100g: 1.3,
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
  "pâtes cuites": {
    kcal_per_100g: 150,
    proteins_g_per_100g: 5,
    carbs_g_per_100g: 30,
    fats_g_per_100g: 1.2,
    fibers_g_per_100g: 1.8,
    sugars_g_per_100g: 0.6,
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
  "huile": {
    kcal_per_100g: 900,
    proteins_g_per_100g: 0,
    carbs_g_per_100g: 0,
    fats_g_per_100g: 100,
    fibers_g_per_100g: 0,
    sugars_g_per_100g: 0,
    salt_g_per_100g: 0,
  },
};

/** Match DICT “contient” (libellé générique) */
function dictMatch(label: string): { key: string; v: NutrPer100 } | null {
  const low = normLabel(label);
  for (const [k, v] of Object.entries(DICT)) {
    if (low.includes(normLabel(k))) return { key: k, v };
  }
  return null;
}

/** OFF helpers */
async function fetchOFFByBarcode(barcode: string): Promise<Candidate | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const r = await fetch(url, { headers: { "user-agent": "files-coaching/1.0" } });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const p = j?.product;
  if (!p) return null;

  const nutr = p.nutriments || {};
  const label = p.product_name || p.generic_name || p.brands || "Produit OFF";

  const kcal100 = toNum(nutr["energy-kcal_100g"]) ?? 0;
  const prot100 = toNum(nutr["proteins_100g"]);
  const carbs100 = toNum(nutr["carbohydrates_100g"]);
  const fat100 = toNum(nutr["fat_100g"]);
  const fiber100 = toNum(nutr["fiber_100g"]);
  const sugar100 = toNum(nutr["sugars_100g"]);
  const salt100 =
    toNum(nutr["salt_100g"]) ??
    (toNum(nutr["sodium_100g"]) != null ? (toNum(nutr["sodium_100g"]) as number) * 2.5 : null);

  // si rien de pertinent
  if (!kcal100 && prot100 == null && carbs100 == null && fat100 == null) return null;

  return {
    label: String(label),
    source: "OFF",
    details: p.brands ? `Marque: ${p.brands}` : undefined,
    confidence: 0.95,
    kcal_per_100g: Math.max(0, Math.round(kcal100)),
    proteins_g_per_100g: clampNull0(prot100),
    carbs_g_per_100g: clampNull0(carbs100),
    fats_g_per_100g: clampNull0(fat100),
    fibers_g_per_100g: clampNull0(fiber100),
    sugars_g_per_100g: clampNull0(sugar100),
    salt_g_per_100g: clampNull0(salt100),
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
    const kcal100 = toNum(nutr["energy-kcal_100g"]) ?? 0;
    const prot100 = toNum(nutr["proteins_100g"]);
    const carbs100 = toNum(nutr["carbohydrates_100g"]);
    const fat100 = toNum(nutr["fat_100g"]);
    const fiber100 = toNum(nutr["fiber_100g"]);
    const sugar100 = toNum(nutr["sugars_100g"]);
    const salt100 =
      toNum(nutr["salt_100g"]) ??
      (toNum(nutr["sodium_100g"]) != null ? (toNum(nutr["sodium_100g"]) as number) * 2.5 : null);

    const name =
      p.product_name ||
      p.generic_name ||
      p.brands ||
      p.categories?.split(",")?.[0] ||
      q;

    if (!kcal100 && prot100 == null && carbs100 == null && fat100 == null) continue;

    out.push({
      label: String(name),
      source: "OFF",
      details: p.brands ? `Marque: ${p.brands}` : undefined,
      confidence: 0.55, // IMPORTANT: recherche par nom = peu fiable
      kcal_per_100g: Math.max(0, Math.round(kcal100)),
      proteins_g_per_100g: clampNull0(prot100),
      carbs_g_per_100g: clampNull0(carbs100),
      fats_g_per_100g: clampNull0(fat100),
      fibers_g_per_100g: clampNull0(fiber100),
      sugars_g_per_100g: clampNull0(sugar100),
      salt_g_per_100g: clampNull0(salt100),
    });
  }
  return out;
}

/** Vision IA : produit vs assiette + barcode/poids si visible */
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
          "Objectif: comprendre ce qu'il y a sur la photo, sans inventer.\n" +
          "1) Dire si c'est une ASSIETTE (plusieurs aliments) ou un PRODUIT unique.\n" +
          "2) Si PRODUIT: extraire name générique, barcode (seulement si lisible), net_weight_g (si visible).\n" +
          "3) Si ASSIETTE: lister les éléments principaux ET séparer sauces/condiments/huiles si visibles.\n" +
          "4) Si le texte est illisible: rester générique (ex: 'pain complet', 'pain', 'riz cuit', 'jambon', 'sauce').\n" +
          "Répondre STRICTEMENT en JSON, aucun texte autour.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Renvoie STRICTEMENT un JSON UNION:\n" +
              "CAS_A (produit): { kind:'product', name:string, barcode:string|null, net_weight_g:number|null }\n" +
              "CAS_B (assiette): { kind:'plate', items:[{ label:string, grams:number }...] }\n" +
              "Max 8 items. Inclure sauces/condiments si présents.",
          },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
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

/** Densify (assiette) : propose macros/100g par item */
async function densifyPlate(items: Array<{ label: string; grams: number }>, apiKey: string) {
  const payload = {
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system",
        content:
          "FRANÇAIS.\n" +
          "Pour chaque élément, donne des valeurs réalistes PAR 100g:\n" +
          "kcal, protéines, glucides, lipides, fibres, sucres, sel.\n" +
          "Si sauce/huile/condiment: valeurs typiques (souvent plus gras/salé).\n" +
          "Répond STRICTEMENT: { items:[{ label, kcal_per_100g, proteins_g_per_100g, carbs_g_per_100g, fats_g_per_100g, fibers_g_per_100g, sugars_g_per_100g, salt_g_per_100g }] }",
      },
      { role: "user", content: [{ type: "text", text: JSON.stringify({ items }, null, 2) }] },
    ],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
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
  return (content?.items || []) as any[];
}

/** Densify (produit fallback) : macros/100g */
async function densifySingle(label: string, apiKey: string): Promise<Candidate> {
  const payload = {
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system",
        content:
          "FRANÇAIS.\n" +
          "Donne une estimation réaliste PAR 100g (aliment générique) :\n" +
          "kcal, protéines, glucides, lipides, fibres, sucres, sel.\n" +
          "Répond STRICTEMENT: { label, kcal_per_100g, proteins_g_per_100g, carbs_g_per_100g, fats_g_per_100g, fibers_g_per_100g, sugars_g_per_100g, salt_g_per_100g }",
      },
      { role: "user", content: [{ type: "text", text: label || "aliment" }] },
    ],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
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

  return {
    label: String(content?.label || label || "aliment"),
    source: "IA",
    details: "Estimation IA (générique)",
    confidence: 0.6,
    kcal_per_100g: Math.max(0, Math.round(clamp0(content?.kcal_per_100g))),
    proteins_g_per_100g: clampNull0(content?.proteins_g_per_100g),
    carbs_g_per_100g: clampNull0(content?.carbs_g_per_100g),
    fats_g_per_100g: clampNull0(content?.fats_g_per_100g),
    fibers_g_per_100g: clampNull0(content?.fibers_g_per_100g),
    sugars_g_per_100g: clampNull0(content?.sugars_g_per_100g),
    salt_g_per_100g: clampNull0(content?.salt_g_per_100g),
  };
}

/** Handler POST */
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

    // 1) Vision: produit vs assiette (+ barcode/poids si possible)
    const vision = await withTimeout(analyzeWithVision(imageDataUrl, apiKey), 25_000);

    /** ===========================
     *  CAS ASSIETTE
     *  =========================== */
    if (vision?.kind === "plate" && Array.isArray(vision.items)) {
      const rawItems = (vision.items as any[])
        .map((x) => ({
          label: String(x?.label || "").trim(),
          grams: Math.max(1, Math.round(Number(x?.grams || 0))),
        }))
        .filter((x) => x.label)
        .slice(0, 8);

      // Densité IA (macros/100g)
      const dens = await withTimeout(densifyPlate(rawItems, apiKey), 20_000).catch(() => []);

      const outItems: PlateItemEstimated[] = rawItems.map((it) => {
        const dm = dictMatch(it.label);
        const low = normLabel(it.label);
        const densMatch = (dens || []).find((d: any) => normLabel(String(d?.label || "")) === low);

        // Base prioritaire : DICT si match, sinon IA densify
        const base: NutrPer100 = dm?.v ?? {
          kcal_per_100g: Math.max(0, Math.round(clamp0(densMatch?.kcal_per_100g))),
          proteins_g_per_100g: clampNull0(densMatch?.proteins_g_per_100g),
          carbs_g_per_100g: clampNull0(densMatch?.carbs_g_per_100g),
          fats_g_per_100g: clampNull0(densMatch?.fats_g_per_100g),
          fibers_g_per_100g: clampNull0(densMatch?.fibers_g_per_100g),
          sugars_g_per_100g: clampNull0(densMatch?.sugars_g_per_100g),
          salt_g_per_100g: clampNull0(densMatch?.salt_g_per_100g),
        };

        return {
          label: it.label,
          grams_estimated: it.grams,
          source: dm ? "DICT" : "IA",
          ...base,
          kcal_per_100g: Math.max(0, Math.round(Number(base.kcal_per_100g || 0))),
        };
      });

      const warnings: string[] = [];
      warnings.push("Quantités estimées sur photo : merci de confirmer le grammage avant calcul.");
      if (outItems.some((x) => /riz|p[âa]tes|poulet|b[œo]uf|saumon/i.test(x.label))) {
        warnings.push("Vérifie cru/cuit : les valeurs changent beaucoup.");
      }
      if (outItems.some((x) => /sauce|huile|mayo|cr[èe]me|roquefort|beurre/i.test(x.label))) {
        warnings.push("Sauces/huile : souvent sous-estimées, ajuste si besoin.");
      }

      const payload: FoodAnalysis = {
        kind: "plate",
        needs_user_confirmation: true,
        items: outItems.slice(0, 8),
        warnings,
      };
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "no-store, no-transform" },
      });
    }

    /** ===========================
     *  CAS PRODUIT
     *  =========================== */
    const rawLabel = String(vision?.name || "").trim();
    const label = rawLabel || "aliment";

    const barcode =
      vision?.barcode && /^\d{8,14}$/.test(String(vision.barcode))
        ? String(vision.barcode)
        : null;

    const netWeight =
      Number(vision?.net_weight_g || 0) > 0 ? Math.round(Number(vision?.net_weight_g)) : null;

    const warnings: string[] = [];
    warnings.push("Portion estimée : merci de confirmer le grammage avant calcul.");

    // (A) Barcode => OFF = source de vérité
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
        return NextResponse.json(payload, {
          headers: { "Cache-Control": "no-store, no-transform" },
        });
      }
      warnings.push("Code-barres détecté mais produit introuvable sur OFF.");
    }

    // (B) Sans barcode => OFF par nom = SUGGESTIONS seulement
    const offCandidates = label ? await searchOFFByName(label).catch(() => []) : [];
    const offTop3 = offCandidates.slice(0, 3);

    // (C) Top = DICT ou IA générique (jamais OFF par nom)
    const dm = dictMatch(label);
    const top: Candidate =
      dm
        ? {
            label,
            source: "DICT",
            details: `Dictionnaire local (générique: ${dm.key})`,
            confidence: 0.8,
            ...dm.v,
          }
        : await densifySingle(label, apiKey);

    // On compose candidates: top + suggestions OFF (au choix côté client)
    const candidates = [top, ...offTop3]
      // petite dédup par label+source
      .filter((c, idx, arr) => {
        const k = `${normLabel(c.label)}|${c.source}`;
        return idx === arr.findIndex((x) => `${normLabel(x.label)}|${x.source}` === k);
      })
      .slice(0, 3);

    if (offTop3.length) {
      warnings.push(
        "Sans code-barres : les résultats OFF par nom sont des suggestions. Choisis un candidat si nécessaire."
      );
    } else {
      warnings.push("Sans code-barres : estimation générique (DICT/IA).");
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

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, no-transform" },
    });
  } catch (e: any) {
    const status = e?.status ?? e?.response?.status ?? 500;
    return jsonError(status, e?.message || "internal_error");
  }
}
