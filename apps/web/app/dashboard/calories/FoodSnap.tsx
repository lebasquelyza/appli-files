// apps/web/app/dashboard/calories/FoodSnap.tsx
"use client";
import * as React from "react";

type AnalyzeResponse = {
  food: string;
  confidence: number;
  kcal_per_100g: number;
  net_weight_g?: number | null;
  nutrition?: {
    carbs_g_per_100g?: number | null;
    sugars_g_per_100g?: number | null;
    proteins_g_per_100g?: number | null;
    fats_g_per_100g?: number | null;
    fiber_g_per_100g?: number | null;
    salt_g_per_100g?: number | null;
  };
};

type Props = {
  today: string;
  onSave?: (formData: FormData) => Promise<void>; // server action passée depuis la page
};

export default function FoodSnap({ today, onSave }: Props) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<AnalyzeResponse | null>(null);
  const [portion, setPortion] = React.useState<number>(250); // g défaut si rien détecté
  const [portionAuto, setPortionAuto] = React.useState<null | number>(null); // mémorise la détection
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
    setPortion(250);
    setPortionAuto(null);
    setPreview(URL.createObjectURL(f));
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
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Analyse impossible");
      }
      const data: AnalyzeResponse = await res.json();
      setResult(data);
      setKcal100(String(data.kcal_per_100g || ""));
      if (typeof data.net_weight_g === "number" && data.net_weight_g > 0) {
        setPortion(data.net_weight_g);
        setPortionAuto(data.net_weight_g);
      }
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

  function buildNote(): string {
    const conf = typeof result?.confidence === "number" ? ` (${Math.round(result!.confidence * 100)}%)` : "";
    const note = `Photo: ${result?.food || "aliment"} ~${portion}g @${kcal100 || "?"}kcal/100g${conf}`;
    return note.slice(0, 120);
  }

  function injectToMainForm() {
    const kcal = estimatedKcal();
    if (!kcal) return;
    const kcalInput = document.querySelector<HTMLInputElement>('form[action][method="post"] input[name="kcal"]');
    const noteInput = document.querySelector<HTMLInputElement>('form[action][method="post"] input[name="note"]');
    if (kcalInput) kcalInput.value = String(kcal);
    if (noteInput) noteInput.value = buildNote();
    const submit = document.querySelector<HTMLButtonElement>('form[action][method="post"] button[type="submit"]');
    submit?.focus();
  }

  return (
    <div className="card" style={{ border: "1px dashed #d1d5db", padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Prendre une photo d’un aliment</div>
          <div className="text-xs" style={{ color: "#6b7280" }}>Lecture d’étiquette quand visible (poids net, kcal/100g).</div>
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
            <button className="btn" onClick={() => { setFile(null); setPreview(null); setResult(null); setKcal100(""); setPortion(250); setPortionAuto(null); setError(null); }}>
              Changer de photo
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-xs" style={{ color: "#dc2626", marginTop: 8 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 14, lineHeight: 1.4 }}>
            <div><strong>Aliment</strong> : {result.food}</div>
            <div><strong>Confiance</strong> : {typeof result.confidence === "number" ? `${Math.round(result.confidence * 100)}%` : "—"}</div>
            <div><strong>kcal / 100 g</strong> : {kcal100 || "—"}</div>
          </div>

          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr", alignItems: "end" }}>
            <label className="label">
              Portion (g)
              <input className="input" type="number" min={1} step={1} value={portion} onChange={(e) => setPortion(Number(e.target.value))} />
            </label>
            <div className="text-xs" style={{ color: "#6b7280" }}>
              {portionAuto ? <>Détecté depuis l’étiquette&nbsp;: <strong>{portionAuto} g</strong></> : "Régle la portion si besoin"}
            </div>
            <label className="label">
              kcal / 100 g
              <input className="input" type="number" min={1} step={1} value={kcal100} onChange={(e) => setKcal100(e.target.value)} placeholder="ex: 130" />
            </label>
            <div className="text-xs" style={{ color: "#6b7280" }}>
              Valeur issue de l’étiquette si visible — sinon estimation IA.
            </div>
          </div>

          {/* (facultatif) Affichage nutrition si disponible */}
          {result.nutrition && (
            <div className="text-xs" style={{ color: "#374151" }}>
              <em>Par 100 g</em> — Glucides: {result.nutrition.carbs_g_per_100g ?? "—"} g (dont sucres {result.nutrition.sugars_g_per_100g ?? "—"} g) ·
              Protéines: {result.nutrition.proteins_g_per_100g ?? "—"} g ·
              Lipides: {result.nutrition.fats_g_per_100g ?? "—"} g ·
              Fibres: {result.nutrition.fiber_g_per_100g ?? "—"} g ·
              Sel: {result.nutrition.salt_g_per_100g ?? "—"} g
            </div>
          )}

          <div style={{ fontSize: 18, fontWeight: 700 }}>
            Total estimé : {estimatedKcal() ?? "—"} kcal
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button className="btn" onClick={injectToMainForm} disabled={!estimatedKcal()}>
              Remplir le formulaire en haut
            </button>
            {onSave && (
              <form action={onSave} style={{ display: "inline-flex", gap: 8 }}>
                <input type="hidden" name="date" value={today} />
                <input type="hidden" name="kcal" value={estimatedKcal() ?? 0} />
                <input type="hidden" name="note" value={buildNote()} />
                <button className="btn btn-dash" type="submit" disabled={!estimatedKcal()}>
                  Ajouter à mes calories
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
