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
    headers: { "content-type": "application/json", "Cache-Control": "no-store, no-transform" },
  });
}
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error("timeout"), { status: 504 })), ms);
    p.then(v => { clearTimeout(t); resolve(v); })
     .catch(e => { clearTimeout(t); reject(e); });
  });
}
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

/** Types */
type FoodItem = {
  label: string;
  grams: number;
  kcal_per_100g: number;
  proteins_g_per_100g?: number | null;
  source?: "OFF" | "IA" | "DICT";
};
type Candidate = {
  label: string;
  kcal_per_100g: number;
  proteins_g_per_100g: number | null;
  source: "OFF" | "IA" | "DICT";
  details?: string;       // ex. marque OFF, code-barres, précision
  confidence?: number;    // 0..1, si IA
};
type FoodAnalysis =
  | {
      // Produit emballé OU aliment unitaire
      top: Candidate;          // meilleur candidat retenu
      candidates: Candidate[]; // top-3 pour basculer côté client
      net_weight_g?: number | null; // si lu sur étiquette
      barcode?: string | null;      // si lu
      warnings?: string[];          // ex. "cru/cuit ambigu"
    }
  | {
      // Assiette maison (décomposition)
      items: FoodItem[];
      total_kcal: number;
      total_proteins_g: number | null;
      warnings?: string[];
    };

/** Dictionnaire local de secours (valeurs FR moyennes cuites) */
const DICT: Record<string, { kcal100: number; prot100: number }> = {
  "riz cuit": { kcal100: 130, prot100: 2.7 },
  "pâte cuite": { kcal100: 150, prot100: 5 },
  "poulet cuit": { kcal100: 165, prot100: 31 },
  "boeuf cuit": { kcal100: 250, prot100: 26 },
  "saumon cuit": { kcal100: 208, prot100: 20 },
  "œuf dur": { kcal100: 155, prot100: 13 },
  "pain": { kcal100: 260, prot100: 9 },
  "fromage": { kcal100: 350, prot100: 25 },
  "pomme": { kcal100: 52, prot100: 0.3 },
  "banane": { kcal100: 89, prot100: 1.1 },
};

/** OpenFoodFacts helpers */
async function fetchOFFByBarcode(barcode: string) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const r = await fetch(url, { headers: { "user-agent": "files-coaching/1.0" } });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const p = j?.product;
  if (!p) return null;
  const kcal100 = p.nutriments?.["energy-kcal_100g"];
  const prot100 = p.nutriments?.["proteins_100g"];
  const label = p.product_name || p.generic_name || p.brands || "Produit OFF";
  if (!kcal100 && !prot100) return null;
  return {
    label,
    kcal_per_100g: Number(kcal100 ?? 0),
    proteins_g_per_100g: prot100 != null ? Number(prot100) : null,
    source: "OFF" as const,
    details: p.brands ? `Marque: ${p.brands}` : undefined,
  };
}

async function searchOFFByName(q: string) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=5`;
  const r = await fetch(url, { headers: { "user-agent": "files-coaching/1.0" } });
  if (!r.ok) return [] as Candidate[];
  const j = await r.json().catch(() => null);
  const out: Candidate[] = [];
  for (const p of j?.products ?? []) {
    const kcal100 = p.nutriments?.["energy-kcal_100g"];
    const prot100 = p.nutriments?.["proteins_100g"];
    const name = p.product_name || p.generic_name || p.brands || p.categories?.split(",")?.[0] || q;
    if (kcal100 || prot100) {
      out.push({
        label: String(name),
        kcal_per_100g: Number(kcal100 ?? 0),
        proteins_g_per_100g: prot100 != null ? Number(prot100) : null,
        source: "OFF",
        details: p.brands ? `Marque: ${p.brands}` : undefined,
      });
    }
  }
  return out;
}

/** Vision IA: identifie, lit barcode et/ou net weight, bascule produit vs assiette */
async function analyzeWithVision(imageDataUrl: string, apiKey: string) {
  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system",
        content:
          "FRANÇAIS UNIQUEMENT. Tâches: (1) dire si c'est une ASSIETTE (plusieurs aliments) ou un PRODUIT unique. " +
          "(2) Si produit: nom, code-barres (si lisible), poids net (g) s'il apparaît. " +
          "(3) Si assiette: liste les principaux éléments (libellé + grammes estimés). Pas d'autres textes.",
      },
      {
        role: "user",
        content: [
          { type: "text", text:
            "Renvoie STRICTEMENT un JSON UNION: \n" +
            "CAS_A (produit): { kind:'product', name:string, barcode:string|null, net_weight_g:number|null }\n" +
            "CAS_B (assiette): { kind:'plate', items:[{ label:string, grams:number }, ...] }"
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
    let parsed: any = null; try { parsed = JSON.parse(txt); } catch {}
    const msg = parsed?.error?.message || txt || `HTTP ${resp.status}`;
    const err: any = new Error(msg); err.status = resp.status;
    throw err;
  }
  let obj: any; try { obj = JSON.parse(txt)?.choices?.[0]?.message?.content; } catch {}
  let out: any; try { out = JSON.parse(obj); } catch { throw Object.assign(new Error("non_json"), { status: 502 }); }
  return out;
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
      return jsonError(415, "Unsupported Media Type. Envoyer multipart/form-data (image) ou JSON { image }.");
    }

    // 1) Vision: produit vs assiette (+ barcode/poids si possible)
    const vision = await withTimeout(analyzeWithVision(imageDataUrl, apiKey), 25_000);

    // ===== CAS PLATE =====
    if (vision?.kind === "plate" && Array.isArray(vision.items)) {
      // Remplit via dictionnaire si possible, sinon fallback IA denses
      const densifyPayload = {
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" as const },
        messages: [
          {
            role: "system",
            content:
              "FRANÇAIS. Pour chaque élément d’assiette, propose kcal/100g et protéines/100g réalistes (cuit si cuit). " +
              "Réponds STRICTEMENT: { items:[{ label, kcal_per_100g, proteins_g_per_100g }...] }",
          },
          {
            role: "user",
            content: [
              { type: "text", text: JSON.stringify({ items: vision.items }, null, 2) },
            ],
          },
        ],
      };
      const densResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(densifyPayload),
      });
      const densTxt = await densResp.text().catch(() => "");
      let dens: any = {};
      try { dens = JSON.parse(densTxt)?.choices?.[0]?.message?.content; } catch {}
      try { dens = JSON.parse(dens); } catch { dens = { items: [] }; }

      const outItems: FoodItem[] = vision.items.map((it: any) => {
        const name = String(it.label || "").toLowerCase();
        const d = Object.entries(DICT).find(([k]) => name.includes(k));
        const densMatch = (dens?.items || []).find((x: any) => (x.label || "").toLowerCase() === name);
        const kcal100 = densMatch?.kcal_per_100g ?? d?.[1]?.kcal100 ?? 0;
        const prot100 = densMatch?.proteins_g_per_100g ?? d?.[1]?.prot100 ?? null;
        return {
          label: it.label,
          grams: Math.max(1, Math.round(Number(it.grams || 0))),
          kcal_per_100g: Math.max(1, Math.round(Number(kcal100 || 0))),
          proteins_g_per_100g: prot100 != null ? Math.max(0, Number(prot100)) : null,
          source: d ? "DICT" : "IA",
        };
      }).slice(0, 8);

      const total_kcal = Math.round(outItems.reduce((s, x) => s + (x.grams * x.kcal_per_100g) / 100, 0));
      const protSum = outItems.reduce((s, x) => s + (x.grams * (Number(x.proteins_g_per_100g || 0))) / 100, 0);
      const total_proteins_g = Math.round(protSum * 10) / 10;

      const warnings: string[] = [];
      // Heuristique: si "riz", "pâtes", "poulet" sans "cuit" ou "cru" → avertir
      if (outItems.some(x => /riz|p[âa]tes|poulet|b[œo]uf|saumon/i.test(x.label))) {
        warnings.push("Vérifie cru/cuit : les denses changent beaucoup.");
      }

      const payload: FoodAnalysis = { items: outItems, total_kcal, total_proteins_g, warnings };
      return NextResponse.json(payload, { headers: { "Cache-Control": "no-store, no-transform" } });
    }

    // ===== CAS PRODUIT =====
    const label = String(vision?.name || "").trim();
    const barcode = vision?.barcode && /^\d{8,14}$/.test(String(vision.barcode)) ? String(vision.barcode) : null;
    const netWeight = Number(vision?.net_weight_g || 0) > 0 ? Math.round(Number(vision?.net_weight_g)) : null;

    const candidates: Candidate[] = [];

    // 2) OFF par code-barres
    if (barcode) {
      const off = await fetchOFFByBarcode(barcode).catch(() => null);
      if (off) candidates.push(off);
    }
    // 3) OFF par nom (si pas trouvé par code-barres)
    if (!candidates.length && label) {
      const list = await searchOFFByName(label).catch(() => []);
      candidates.push(...list.slice(0, 3));
    }

    // 4) Fallback IA densités (si OFF vide)
    if (!candidates.length) {
      const densPayload = {
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" as const },
        messages: [
          {
            role: "system",
            content:
              "FRANÇAIS. Donne une estimation réaliste pour {kcal/100g, protéines/100g} de l'aliment décrit. " +
              "Réponds STRICTEMENT: { label, kcal_per_100g, proteins_g_per_100g }",
          },
          { role: "user", content: [{ type: "text", text: label || "aliment" }] },
        ],
      };
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(densPayload),
      });
      const t = await r.text().catch(() => "");
      let dens: any = {};
      try { dens = JSON.parse(t)?.choices?.[0]?.message?.content; } catch {}
      try { dens = JSON.parse(dens); } catch { dens = {}; }

      // Dictionnaire en dernier recours
      let dictHit: Candidate | null = null;
      if (!dens?.kcal_per_100g) {
        const d = Object.entries(DICT).find(([k]) => (label || "").toLowerCase().includes(k));
        if (d) dictHit = { label: d[0], kcal_per_100g: d[1].kcal100, proteins_g_per_100g: d[1].prot100, source: "DICT" };
      }
      candidates.push(
        dictHit ?? {
          label: dens?.label || label || "aliment",
          kcal_per_100g: Math.max(0, Math.round(Number(dens?.kcal_per_100g || 0))),
          proteins_g_per_100g: dens?.proteins_g_per_100g != null ? Math.max(0, Number(dens?.proteins_g_per_100g)) : null,
          source: "IA",
          details: "Estimation IA",
          confidence: 0.6,
        }
      );
    }

    // Clamp & pick top
    const clean = candidates
      .map(c => ({
        ...c,
        label: String(c.label || label || "aliment"),
        kcal_per_100g: Math.max(0, Math.round(Number(c.kcal_per_100g || 0))),
        proteins_g_per_100g: c.proteins_g_per_100g != null ? Math.max(0, Number(c.proteins_g_per_100g)) : null,
      }))
      .slice(0, 3);

    const warnings: string[] = [];
    if (!barcode && /poulet|riz|p[âa]tes|viande|poisson/i.test(label)) {
      warnings.push("Ambigu cru/cuit : ajuste si besoin.");
    }

    const payload: FoodAnalysis = {
      top: clean[0],
      candidates: clean,
      net_weight_g: netWeight,
      barcode: barcode || null,
      warnings,
    };
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store, no-transform" } });

  } catch (e: any) {
    const status = e?.status ?? e?.response?.status ?? 500;
    return jsonError(status, e?.message || "internal_error");
  }
}
