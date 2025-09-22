// apps/web/app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";

/* ============ Types ============ */
type AnalysisPoint = { time: number; label: string; detail?: string };
type Candidate = { label: string; confidence: number };
type AIAnalysis = {
  exercise: string;
  confidence: number;
  overall: string;
  muscles: string[];
  cues: string[];
  extras?: string[];
  timeline: AnalysisPoint[];
  candidates?: Candidate[];
  objects?: string[];
  movement_pattern?: string;
  rawText?: string;
};

/* ============ Next runtime ============ */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

/* ============ Utils ============ */
function jsonError(status: number, msg: string, extra: Record<string, string> = {}) {
  return new NextResponse(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json", "Cache-Control": "no-store, no-transform", ...extra },
  });
}
function hashKey(frames: string[], feeling: string, economy: boolean, openSet: boolean, maxCandidates: number, promptHints?: string) {
  const s = [
    frames.join("|").slice(0, 2000),
    feeling || "",
    economy ? "e1" : "e0",
    openSet ? "os1" : "os0",
    `k=${maxCandidates}`,
    promptHints || "",
  ].join("::");
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error("timeout"), { status: 504 })), ms);
    p.then(v => { clearTimeout(t); resolve(v); })
     .catch(e => { clearTimeout(t); reject(e); });
  });
}

/* ============ Image sanitizer ============ */
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
function shortPreview(u: string) { return u.length <= 100 ? u : `${u.slice(0, 80)}…(${u.length} chars)`; }

/* ============ Cache (anti double-clic) ============ */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { t: number; json: AIAnalysis }>();

/* ===================== Francisation ===================== */
function frLabel(label: string): string {
  const s = (label || "").trim();
  const pairs: Array<[RegExp, string]> = [
    [/^pull[\s-]?up$/i, "Traction"],
    [/^chin[\s-]?up$/i, "Traction supination (chin-up)"],
    [/^chest[\s-]?to[\s-]?bar$/i, "Traction poitrine (chest-to-bar)"],
    [/^push[\s-]?up$/i, "Pompes"],
    [/^bench[\s-]?press$/i, "Développé couché"],
    [/^shoulder[\s-]?press$/i, "Développé militaire"],
    [/^overhead[\s-]?press$/i, "Développé militaire"],
    [/^dead[\s-]?lift$/i, "Soulevé de terre"],
    [/^(romanian|rdl)(?:.*deadlift)?$/i, "Soulevé de terre roumain"],
    [/^front[\s-]?squat$/i, "Front squat"],
    [/^squat$/i, "Squat"],
    [/^lunge|^forward[\s-]?lunge|^reverse[\s-]?lunge$/i, "Fente"],
    [/^bent[\s-]?over[\s-]?row$/i, "Rowing buste penché"],
    [/^row(ing)?( bar| avec barre)?$/i, "Rowing barre"],
    [/^lat[\s-]?pull[\s-]?down$/i, "Tirage vertical (lat pulldown)"],
    [/^seated[\s-]?row$/i, "Tirage horizontal assis"],
    [/^box[\s-]?jump$/i, "Saut sur box"],
    [/^hip[\s-]?thrust$/i, "Extension de hanches (hip thrust)"],
    [/^plank$/i, "Planche"],
    [/^burpees?$/i, "Burpees"],
  ];
  for (const [re, fr] of pairs) if (re.test(s)) return fr;
  return s; // par défaut: retourne tel quel (déjà FR ou inconnu)
}

/* ============ GET diag ============ */
export async function GET() {
  const hasOpenAI = !!(process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY);
  return NextResponse.json(
    { ok: true, openaiKey: hasOpenAI, cacheKeys: cache.size },
    { headers: { "Cache-Control": "no-store, no-transform" } }
  );
}

/* ============ POST (JSON → JSON) ============ */
export async function POST(req: NextRequest) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return jsonError(415, "JSON attendu: { frames: string[], timestamps?: number[], feeling?: string, selftest?: boolean, openSet?: boolean, maxCandidates?: number, promptHints?: string }");
    }

    const body = await req.json();
    const selftest: boolean = !!body.selftest;
    let frames: string[] = Array.isArray(body.frames) ? body.frames : [];
    let timestamps: number[] = Array.isArray(body.timestamps) ? body.timestamps : [];
    const feeling: string = typeof body.feeling === "string" ? body.feeling : "";
    const economy: boolean = body.economyMode !== false;

    // Open-set params
    const openSet: boolean = body.openSet !== false; // par défaut true
    const maxCandidatesRaw = Number.isFinite(body.maxCandidates) ? Number(body.maxCandidates) : 5;
    const maxCandidates = Math.max(1, Math.min(10, maxCandidatesRaw));
    const promptHints: string = typeof body.promptHints === "string" ? body.promptHints : "";

    // Clé OpenAI
    const rawKey = (process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY || "").trim();
    if (!rawKey || !rawKey.startsWith("sk-") || rawKey.length < 40) {
      const hint = rawKey ? `${rawKey.slice(0, 6)}… (len=${rawKey.length})` : "EMPTY";
      return jsonError(500, `Clé OpenAI absente ou invalide côté runtime (valeur lue: ${hint}).`);
    }
    const apiKey = rawKey;

    // Entrées
    if (!selftest && !frames.length) return jsonError(400, "Aucune frame fournie.");

    // ✅ conserver jusqu'à 4 images (multi-mosaïques depuis la vidéo)
    const MAX_IMAGES = 4;
    if (frames.length > MAX_IMAGES) {
      frames = frames.slice(0, MAX_IMAGES);
      timestamps = timestamps.slice(0, MAX_IMAGES);
    }

    // Sanitize toutes les images
    const imageParts = frames.map((f: string) => {
      const img = sanitizeImageInput(f);
      if (!img.ok) throw Object.assign(new Error(`Image invalide (${img.reason})`), { status: 400 });
      return { type: "image_url", image_url: { url: img.url } };
    });

    console.log("[analyze] images:", imageParts.map(p => shortPreview((p as any).image_url.url)));

    // cache
    const key = selftest ? "selftest" : hashKey(frames, feeling || "", economy, openSet, maxCandidates, promptHints);
    const hit = !selftest ? cache.get(key) : null;
    if (hit && Date.now() - hit.t < CACHE_TTL_MS) {
      return NextResponse.json(hit.json, { headers: { "Cache-Control": "no-store, no-transform" } });
    }

    // ===== Prompt & JSON strict (FR) =====
    const baseInstruction =
      `Analyse des images (mosaïques) PROVENANT D'UNE VIDEO (pas d'une simple photo).\n` +
      `Langue: FRANÇAIS UNIQUEMENT. Tous les champs et le texte doivent être en français.\n` +
      `Objectif: identifier l'exercice (open-set: tout exercice connu), proposer TOP-${maxCandidates} candidats et fournir des corrections.\n\n` +
      `Checklist visuelle:\n` +
      `1) Objets: barre de traction fixe au-dessus ? barre libre ? haltères ? kettlebells ? box/step ? machine guidée ? câble ? banc ? rack ? tapis, vélo, rameur ?\n` +
      `2) Contacts: mains agrippent une barre fixe ? pieds sur box ? barre sur dos/épaules/sol ?\n` +
      `3) Motif: vertical (saut/traction/squat), horizontal (fente/rameur), pendulaire (kipping), bilatéral vs unilatéral.\n` +
      `4) Repères anatomiques: mains au-dessus de la tête ? coudes flexion/extension ? hanche descend/monte ? translation vers surface surélevée ?\n\n` +
      `Règles fortes:\n` +
      `• Mains agrippant une BARRE FIXE au-dessus de la tête la plupart du temps + suspension du corps -> Traction (pull-up/chin-up/chest-to-bar), PAS saut sur box.\n` +
      `• Pieds qui quittent le sol puis atterrissent sur une BOX/PLATEAU avec translation -> Saut sur box (box jump).\n` +
      `• Si indices insuffisants: exercise="inconnu", confidence faible.\n\n` +
      `Sortie STRICTEMENT en JSON (response_format json_object).\n` +
      `Champs: {"exercise":string,"confidence":number,"overall":string,"muscles":string[],"cues":string[],"extras":string[],"timeline":[{"time":number,"label":string,"detail"?:string}],"candidates":[{"label":string,"confidence":number}],"objects":string[],"movement_pattern":string}\n` +
      `Contraintes: confidence∈[0..1]; muscles≤5, cues≤5, extras≤5, timeline≤4; candidates=TOP-${maxCandidates} triés décroissant, sans doublons.\n` +
      `Style des "cues": impératifs courts en français (ex.: "Gaine le tronc", "Descends contrôlé").`;

    const userTextParts: string[] = [];
    if (feeling) userTextParts.push(`Ressenti: ${feeling}`);
    if (typeof (timestamps?.[0]) === "number") userTextParts.push(`repere=${Math.round(timestamps[0])}s`);
    if (promptHints) userTextParts.push(`Hints: ${promptHints}`);

    // Appel OpenAI
    const p = fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: openSet ? 0.2 : 0.15,
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: baseInstruction },
          { role: "user", content: [{ type: "text", text: userTextParts.join("\n") || "Analyse les mosaïques." }, ...imageParts] },
        ],
      }),
    }).then(async (resp) => {
      const txt = await resp.text().catch(() => "");
      if (!resp.ok) {
        let parsed: any = null; try { parsed = JSON.parse(txt); } catch {}
        const err: any = new Error(parsed?.error?.message || txt || `HTTP ${resp.status}`);
        err.status = resp.status; err.details = parsed?.error ?? txt;
        throw err;
      }
      try { return JSON.parse(txt); }
      catch {
        const err: any = new Error("Réponse OpenAI non JSON.");
        err.status = 502; err.details = txt?.slice?.(0, 500);
        throw err;
      }
    });

    const json = await withTimeout(p, 25_000);
    const text: string = json?.choices?.[0]?.message?.content || "";
    if (!text) return jsonError(502, "Réponse vide du modèle.");

    let parsed: AIAnalysis | null = null;
    try { parsed = JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    if (!parsed || typeof parsed !== "object") {
      return jsonError(502, "Impossible de parser la réponse JSON.");
    }

    parsed.muscles ||= []; parsed.cues ||= []; parsed.extras ||= []; parsed.timeline ||= [];
    if (!Array.isArray(parsed.candidates)) parsed.candidates = [];
    if (!Array.isArray(parsed.objects)) parsed.objects = [];

    // Clamp / tri + francisation
    parsed.candidates = (parsed.candidates || [])
      .map(c => ({ label: frLabel(String(c?.label || "").trim()), confidence: Math.max(0, Math.min(1, Number(c?.confidence) || 0)) }))
      .filter(c => c.label)
      .slice(0, maxCandidates);

    parsed.exercise = frLabel(parsed.exercise || "exercice_inconnu");
    parsed.confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));

    cache.set(key, { t: Date.now(), json: parsed });
    return NextResponse.json(parsed, { headers: { "Cache-Control": "no-store, no-transform" } });
  } catch (e: any) {
    const status = e?.status ?? e?.response?.status;
    return jsonError(Number.isInteger(status) ? status : 500, e?.message || "Erreur interne");
  }
}
