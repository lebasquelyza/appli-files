// apps/web/app/api/food/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

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

type FoodItem = {
  label: string;
  grams: number;            // portion estimée
  kcal_per_100g: number;    // densité estimée
};
type FoodAnalysis = {
  // Cas “produit emballé” (étiquette)
  food?: string;
  confidence?: number;
  kcal_per_100g?: number;
  net_weight_g?: number | null;
  nutrition?: {
    carbs_g_per_100g?: number | null;
    sugars_g_per_100g?: number | null;
    proteins_g_per_100g?: number | null;
    fats_g_per_100g?: number | null;
    fiber_g_per_100g?: number | null;
    salt_g_per_100g?: number | null;
  };
  // Cas “assiette maison” (décomposition)
  items?: FoodItem[];       // ex: [{label:"riz", grams:160, kcal_per_100g:130}, ...]
  total_kcal?: number;      // somme des items (arrondie)
};

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

    // Prompt: supporte ETIQUETTE (produit) OU ASSIETTE (décomposition multi-ingrédients)
    const payload = {
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" as const },
      messages: [
        {
          role: "system",
          content:
            "FRANÇAIS UNIQUEMENT. Tu es un expert en nutrition visuelle. " +
            "Si c'est un PRODUIT EMBALLÉ avec étiquette visible, lis POIDS NET et VALEURS/100g. " +
            "Si c'est une ASSIETTE MAISON, identifie les principaux aliments, estime les GRAMMES par élément et les KCAL/100g plausibles, puis calcule le total.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Renvoie STRICTEMENT un JSON. Deux cas possibles :\n\n" +
                "CAS_A (produit emballé) => {\n" +
                '  "food": string,\n' +
                '  "confidence": number,                // 0..1\n' +
                '  "kcal_per_100g": number,             // étiquette si visible, sinon estimation\n' +
                '  "net_weight_g": number|null,         // ex: 90\n' +
                '  "nutrition": {                       // optionnel, valeurs/100g si visibles\n' +
                '    "carbs_g_per_100g": number|null,\n' +
                '    "sugars_g_per_100g": number|null,\n' +
                '    "proteins_g_per_100g": number|null,\n' +
                '    "fats_g_per_100g": number|null,\n' +
                '    "fiber_g_per_100g": number|null,\n' +
                '    "salt_g_per_100g": number|null\n' +
                "  }\n" +
                "}\n\n" +
                "CAS_B (assiette maison) => {\n" +
                '  "items": [ { "label": string, "grams": number, "kcal_per_100g": number }, ... ],\n' +
                '  "total_kcal": number\n' +
                "}\n\n" +
                "Choisis UN SEUL cas selon l'image. Pas d'autres champs ni de texte libre.",
            },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    };

    const p = fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    }).then(async (resp) => {
      const txt = await resp.text().catch(() => "");
      if (!resp.ok) {
        let parsed: any = null; try { parsed = JSON.parse(txt); } catch {}
        const msg = parsed?.error?.message || txt || `HTTP ${resp.status}`;
        const err: any = new Error(msg); err.status = resp.status;
        throw err;
      }
      let parsed: any = {}; try { parsed = JSON.parse(txt); } catch { throw Object.assign(new Error("non_json"), { status: 502 }); }
      return parsed;
    });

    const json = await withTimeout(p, 25_000);
    const content = json?.choices?.[0]?.message?.content || "{}";

    let out: FoodAnalysis | null = null;
    try { out = JSON.parse(content); } catch { return jsonError(502, "bad_model_json"); }

    // Petites sécurités
    if (out?.items?.length) {
      out.items = out.items
        .filter(it => it && it.label && Number.isFinite(Number(it.grams)) && Number(it.grams) > 0 && Number.isFinite(Number(it.kcal_per_100g)) && Number(it.kcal_per_100g) > 0)
        .slice(0, 8)
        .map(it => ({ label: String(it.label), grams: Math.round(Number(it.grams)), kcal_per_100g: Math.round(Number(it.kcal_per_100g)) }));
      const sum = out.items.reduce((s, it) => s + (it.grams * it.kcal_per_100g) / 100, 0);
      out.total_kcal = Math.round(sum);
    } else {
      // Clamp champs produit
      if (typeof out?.confidence === "number") out.confidence = Math.max(0, Math.min(1, out.confidence));
      if (typeof out?.kcal_per_100g === "number") out.kcal_per_100g = Math.max(0, out.kcal_per_100g);
      if (out?.net_weight_g != null) out.net_weight_g = Math.max(0, Number(out.net_weight_g));
    }

    return NextResponse.json(out ?? {}, { headers: { "Cache-Control": "no-store, no-transform" } });
  } catch (e: any) {
    const status = e?.status ?? e?.response?.status ?? 500;
    return jsonError(status, e?.message || "internal_error");
  }
}
