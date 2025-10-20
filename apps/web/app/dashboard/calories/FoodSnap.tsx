"use client";
import * as React from "react";

type AnalyzeResponse = {
  food: string;          // libellé détecté par l'IA
  confidence: number;    // 0..1
  kcal_per_100g: number; // moyenne kcal / 100 g
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
  const [portion, setPortion] = React.useState<number>(250); // g
  const [kcal100, setKcal100] = React.useState<string>("");  // string pour l’input
  const [error, setError] = React.useState<string | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);

  function onPick() {
    inputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setKcal100("");
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

  // Note compacte (<= 120 chars, gérée aussi côté server action)
  function buildNote(): string {
    const conf = typeof result?.confidence === "number" ? ` (${Math.round(result!.confidence * 100)}%)` : "";
    const text = `Photo: ${result?.food || "aliment"} ~${portion}g @${kcal100 || "?"}kcal/100g${conf}`;
    return text.slice(0, 120);
  }

  // Option A (déjà présente sur ta page) : injecter dans le formulaire principal
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
          <div className="text-xs" style={{ color: "#6b7280" }}>Analyse IA, récap, puis ajout direct à tes calories.</div>
        </div>
        <button className="btn" onClick={onPick} style={{ fontSize: 13 }}>📸 Prendre/Choisir</button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          hidden
        />
      </div>

      {preview && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <img src={preview} alt="prévisualisation" style={{ maxWidth: "100%", borderRadius: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-dash" onClick={analyze} disabled={loading}>
              {loading ? "Analyse…" : "Analyser la photo"}
            </button>
            <button
              className="btn"
              onClick={() => {
                setFile(null);
                setPreview(null);
                setResult(null);
                setKcal100("");
                setError(null);
              }}
            >
              Changer de photo
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs" style={{ color: "#dc2626", marginTop: 8 }}>
          {error.includes("missing_OPENAI_API_KEY")
            ? <>Configure <code>OPENAI_API_KEY</code> dans l’environnement serveur.</>
            : error}
        </div>
      )}

      {/* ---- Récap complet + actions ---- */}
      {result && (
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 14, lineHeight: 1.4 }}>
            <div><strong>Aliment</strong> : {result.food}</div>
            <div><strong>Confiance</strong> : {typeof result.confidence === "number" ? `${Math.round(result.confidence * 100)}%` : "—"}</div>
            <div><strong>kcal / 100 g</strong> : {kcal100 || "—"}</div>
          </div>

          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
            <label className="label">
              Portion (g)
              <input
                className="input"
                type="number"
                min={1}
                step={1}
                value={portion}
                onChange={(e) => setPortion(Number(e.target.value))}
              />
            </label>
            <label className="label">
              kcal / 100 g
              <input
                className="input"
                type="number"
                min={1}
                step={1}
                value={kcal100}
                onChange={(e) => setKcal100(e.target.value)}
                placeholder="ex: 130"
              />
            </label>
          </div>

          <div className="text-sm" style={{ color: "#6b7280" }}>
            Ajuste si besoin : la densité dépend de la recette et de la cuisson.
          </div>

          <div style={{ fontSize: 18, fontWeight: 700 }}>
            Total estimé : {estimatedKcal() ?? "—"} kcal
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {/* Option A : remplir le formulaire principal existant */}
            <button className="btn" onClick={injectToMainForm} disabled={!estimatedKcal()}>
              Remplir le formulaire en haut
            </button>

            {/* Option B : enregistrement direct via server action passée en prop */}
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
