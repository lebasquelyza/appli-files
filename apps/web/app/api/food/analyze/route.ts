// apps/web/app/api/food/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

/* Utils */
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

/* GET de diagnostic rapide (utile pour vérifier le 404) */
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/food/analyze" }, { headers: { "Cache-Control": "no-store" } });
}

/* POST: IA vision -> { food, confidence, kcal_per_100g } */
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

    const payload = {
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" as const },
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert en reconnaissance alimentaire. En FRANÇAIS UNIQUEMENT, identifie l'aliment/plat principal, " +
            "donne une confiance (0..1), et une estimation réaliste FR des kcal pour 100 g.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analyse l'image et renvoie STRICTEMENT un JSON: " +
                '{ "food": string, "confidence": number, "kcal_per_100g": number }',
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
      let parsed: any = {};
      try { parsed = JSON.parse(txt); } catch { throw Object.assign(new Error("non_json"), { status: 502, detail: txt?.slice?.(0,400) }); }
      return parsed;
    });

    const json = await withTimeout(p, 25_000);
    const content = json?.choices?.[0]?.message?.content || "{}";

    let out = { food: "aliment", confidence: 0, kcal_per_100g: 0 };
    try {
      const parsed = JSON.parse(content);
      out = {
        food: String(parsed.food || "aliment"),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))),
        kcal_per_100g: Math.max(0, Number(parsed.kcal_per_100g || 0)),
      };
    } catch {
      return jsonError(502, "bad_model_json");
    }

    return NextResponse.json(out, { headers: { "Cache-Control": "no-store, no-transform" } });
  } catch (e: any) {
    const status = e?.status ?? e?.response?.status ?? 500;
    return jsonError(status, e?.message || "internal_error");
  }
}
