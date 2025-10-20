# File: app/dashboard/calories/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import FoodSnap from "./FoodSnap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type KcalStore = Record<string, number>; // "YYYY-MM-DD" -> kcal
type NotesStore = Record<string, string>; // "YYYY-MM-DD" -> note (texte)

/* ---------- Utils ---------- */
const TZ = "Europe/Paris" as const;
function todayISO(tz = TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

function parseKcalStore(raw?: string): KcalStore {
  try {
    const data = JSON.parse(raw || "{}");
    if (data && typeof data === "object") {
      const out: KcalStore = {};
      for (const [k, v] of Object.entries<any>(data)) {
        const n = Number(v);
        if (Number.isFinite(n)) out[k] = n;
      }
      return out;
    }
  } catch {}
  return {};
}

function parseNotesStore(raw?: string): NotesStore {
  try {
    const data = JSON.parse(raw || "{}");
    if (data && typeof data === "object") {
      const out: NotesStore = {};
      for (const [k, v] of Object.entries<any>(data)) {
        if (v != null) out[k] = String(v);
      }
      return out;
    }
  } catch {}
  return {};
}

function pruneStore(store: Record<string, unknown>, keepDays = 60) {
  const keys = Object.keys(store).sort(); // "YYYY-MM-DD"
  const toDrop = Math.max(0, keys.length - keepDays);
  for (let i = 0; i < toDrop; i++) delete (store as any)[keys[i]];
}

/* ---------- Server action: enregistre kcal ---------- */
export async function saveCalories(formData: FormData) {
  "use server";
  const date = String(formData.get("date") || todayISO());
  const kcal = Number(formData.get("kcal"));
  const note = (formData.get("note") || "").toString().slice(0, 120);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/dashboard/calories?err=bad_date");
  if (!Number.isFinite(kcal) || kcal < 0 || kcal > 50000) redirect("/dashboard/calories?err=bad_kcal");

  const jar = cookies();
  const store = parseKcalStore(jar.get("app.kcals")?.value);

  // on cumule au jour
  store[date] = (store[date] || 0) + Math.round(kcal);
  pruneStore(store, 60);

  jar.set("app.kcals", JSON.stringify(store), {
    path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false,
  });

  if (note) {
    const notes = parseNotesStore(jar.get("app.kcals.notes")?.value);
    notes[date] = note; // <-- string dans un store string ✅
    pruneStore(notes, 60);
    jar.set("app.kcals.notes", JSON.stringify(notes), {
      path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: false,
    });
  }

  redirect("/dashboard/calories?saved=1#saved");
}

/* ---------- Page ---------- */
export default async function Page({ searchParams }: { searchParams?: { saved?: string; err?: string } }) {
  const jar = cookies();
  const store = parseKcalStore(jar.get("app.kcals")?.value);
  const notes = parseNotesStore(jar.get("app.kcals.notes")?.value);

  const today = todayISO();
  const todayKcal = store[today] || 0;

  // Vue 14 jours
  const days: { date: string; kcal: number; note?: string }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
    days.push({ date, kcal: store[date] || 0, note: notes[date] });
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="page-header" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="h1" style={{ fontSize: 22, color: "#111827" }}>Calories</h1>
          <p className="lead" style={{ fontSize: 13, marginTop: 4 }}>
            Enregistre tes calories consommées aujourd’hui. Historique sur 14 jours.
          </p>
        </div>
      </div>

      {searchParams?.saved && (
        <div id="saved" className="card" style={{ border: "1px solid #16a34a33", background: "#16a34a0d", marginBottom: 12 }}>
          <strong>Enregistré !</strong> Tes calories ont été mises à jour.
        </div>
      )}
      {searchParams?.err && (
        <div className="card" style={{ border: "1px solid #dc262633", background: "#dc26260d", marginBottom: 12 }}>
          <strong>Erreur</strong> : {searchParams.err === "bad_date" ? "date invalide." : "valeur de calories invalide."}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="card">
          <h3 style={{ marginTop: 0, fontSize: 16, color: "#111827" }}>Aujourd’hui</h3>
          <div className="text-sm" style={{ color: "#6b7280", fontSize: 14 }}>{today}</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8, color: "#111827", lineHeight: 1 }}>
            {todayKcal.toLocaleString("fr-FR")} kcal
          </div>

          {/* --- AJOUT: module photo+nutrition --- */}
          <div style={{ marginTop: 12 }}>
            <FoodSnap today={today} />
          </div>

          <form action={saveCalories} style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <input type="hidden" name="date" value={today} />
            <div>
              <label className="label">Calories à ajouter</label>
              <input
                className="input"
                type="number"
                name="kcal"
                min={0}
                step={1}
                placeholder="ex: 650"
                required
                style={{
                  background: "#ffffff",
                  color: "#111827",
                  border: "1px solid #d1d5db",
                  caretColor: "#111827",
                  WebkitTextFillColor: "#111827" as any
                }}
              />
              <div className="text-xs" style={{ color: "#6b7280", marginTop: 4, fontSize: 12 }}>
                La valeur s’ajoute au total du jour (elle n’écrase pas).
              </div>
            </div>
            <div>
              <label className="label">Note (optionnel)</label>
              <input
                className="input"
                type="text"
                name="note"
                placeholder="ex: Déj: poke bowl"
                style={{
                  background: "#ffffff",
                  color: "#111827",
                  border: "1px solid #d1d5db",
                  caretColor: "#111827",
                  WebkitTextFillColor: "#111827" as any
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {/* Principal = vert */}
              <button className="btn btn-dash" type="submit" style={{ fontSize: 14 }}>Enregistrer</button>
              {/* Secondaire = NOIR SUR BLANC */}
              <a
                href="/dashboard/calories"
                className="btn"
                style={{
                  background: "#ffffff",
                  color: "#111827",
                  border: "1px solid #d1d5db",
                  fontWeight: 500,
                  fontSize: 14
                }}
              >
                Actualiser
              </a>
            </div>
          </form>
        </article>

        <article className="card">
          <details>
            <summary
              style={{
                listStyle: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, color: "#111827" }}>Historique (14 jours)</h3>
              <span className="text-sm" style={{ color: "#6b7280", fontSize: 14 }}>
                (cliquer pour afficher/masquer)
              </span>
            </summary>

            <div className="text-sm" style={{ color: "#6b7280", margin: "6px 0 6px", fontSize: 14 }}>
              Les jours sans saisie sont à 0 kcal.
            </div>

            <div className="table-wrapper" style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Date</th>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>kcal</th>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d.date}>
                      <td style={{ padding: "6px 8px" }}>
                        {new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(d.date))}
                        <span style={{ color: "#6b7280", marginLeft: 6, fontSize: 12 }}>({d.date})</span>
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "tabular-nums" }}>
                        {d.kcal.toLocaleString("fr-FR")}
                      </td>
                      <td style={{ padding: "6px 8px", color: "#374151" }}>
                        {d.note || <span style={{ color: "#9ca3af" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </article>
      </div>
    </div>
  );
}


# File: app/dashboard/calories/FoodSnap.tsx
"use client";
import * as React from "react";

/**
 * FoodSnap — version IA only
 * - Photo -> détection 100% IA (/api/food/analyze)
 * - L'IA renvoie un aliment + confiance + kcal/100g (moyenne FR)
 * - L'utilisateur peut ajuster la portion (g) et, si besoin, corriger la densité kcal/100g
 * - Le résultat est injecté dans le formulaire principal
 */

type AnalyzeResponse = {
  food: string;            // ex "poulet rôti"
  confidence: number;      // 0..1
  kcal_per_100g: number;   // ex 215
};

export default function FoodSnap({ today }: { today: string }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<AnalyzeResponse | null>(null);
  const [portion, setPortion] = React.useState<number>(250); // g par défaut
  const [kcal100, setKcal100] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);

  function onPick() { inputRef.current?.click(); }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setKcal100("");
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch("/api/food/analyze", { method: "POST", body });
      if (!res.ok) {
        const txt = await res.text().catch(()=>"");
        throw new Error(txt || "Analyse impossible");
      }
      const data: AnalyzeResponse = await res.json();
      setResult(data);
      setKcal100(String(data.kcal_per_100g || ""));
    } catch (e: any) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  function estimatedKcal(): number | null {
    const n = Number((kcal100 || "").trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round((n * (portion || 0)) / 100);
  }

  function injectToMainForm() {
    const kcal = estimatedKcal();
    if (!kcal) return;
    const kcalInput = document.querySelector<HTMLInputElement>('form[action][method="post"] input[name="kcal"]');
    const noteInput = document.querySelector<HTMLInputElement>('form[action][method="post"] input[name="note"]');
    if (kcalInput) kcalInput.value = String(kcal);
    if (noteInput) noteInput.value = `Photo: ${result?.food || "aliment"} (~${portion}g)`;
    const submit = document.querySelector<HTMLButtonElement>('form[action][method="post"] button[type="submit"]');
    submit?.focus();
  }

  return (
    <div className="card" style={{ border: "1px dashed #d1d5db", padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Prendre une photo d’un aliment</div>
          <div className="text-xs" style={{ color: "#6b7280" }}>Détection 100% IA + calcul des kcal.</div>
        </div>
        <button className="btn" onClick={onPick} style={{ fontSize: 13 }}>📸 Prendre/Choisir</button>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
      </div>

      {preview && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <img src={preview} alt="prévisualisation" style={{ maxWidth: "100%", borderRadius: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-dash" onClick={analyze} disabled={loading}>
              {loading ? "Analyse…" : "Analyser la photo"}
            </button>
            <button className="btn" onClick={() => { setFile(null); setPreview(null); setResult(null); setKcal100(""); }}>
              Changer de photo
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs" style={{ color: "#dc2626", marginTop: 8 }}>
          {error.includes("OPENAI_API_KEY") ? (
            <>Configure <code>OPENAI_API_KEY</code> dans <code>.env.local</code> pour activer la détection IA.</>
          ) : (
            error
          )}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 14 }}>
            IA : <strong>{result.food}</strong> {typeof result.confidence === "number" && `(${Math.round(result.confidence * 100)}%)`}
          </div>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
            <label className="label">Portion estimée (g)
              <input className="input" type="number" min={1} step={1} value={portion} onChange={(e) => setPortion(Number(e.target.value))} />
            </label>
            <label className="label">kcal / 100 g
              <input className="input" type="number" min={1} step={1} value={kcal100} onChange={(e) => setKcal100(e.target.value)} placeholder="ex: 130" />
            </label>
          </div>
          <div className="text-sm" style={{ color: "#6b7280" }}>
            Les valeurs sont des moyennes. Tu peux corriger la densité si besoin.
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            Total estimé : {estimatedKcal() ?? "—"} kcal
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-dash" disabled={!estimatedKcal()} onClick={injectToMainForm}>
              Remplir le formulaire
            </button>
            <button className="btn" onClick={() => setResult(null)}>Réinitialiser</button>
          </div>
        </div>
      )}
    </div>
  );
}

# File: app/api/food/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Détection IA universelle :
 * - Reçoit { image: File }
 * - Utilise un modèle de vision pour renvoyer { food, confidence, kcal_per_100g }
 * - Nécessite OPENAI_API_KEY (sinon 400 explicite)
 */

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_image" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "missing_OPENAI_API_KEY" }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");

    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Tu es un expert en vision alimentaire. Donne une seule classe d'aliment précise en français, puis une estimation moyenne de kcal/100g pour la France." },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyse l'image et renvoie STRICTEMENT un JSON {\"food\":string, \"confidence\":number, \"kcal_per_100g\":number}. Aucune autre sortie. La valeur kcal/100g doit être réaliste pour l'aliment identifié." },
            { type: "image_url", image_url: { url: `data:${file.type};base64,${base64}` } },
          ],
        },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    } as const;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Vision API error:", err);
      return NextResponse.json({ error: "vision_error" }, { status: 500 });
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {}

    const out = {
      food: String(parsed.food || "aliment"),
      confidence: Number(parsed.confidence || 0),
      kcal_per_100g: Number(parsed.kcal_per_100g || 0),
    };

    return NextResponse.json(out);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "analyze_failed" }, { status: 500 });
  }
}
