"use client";
import * as React from "react";

type AnalyzeResponse = {
  food: string;          // libellé détecté par l'IA
  confidence: number;    // 0..1
  kcal_per_100g: number; // moyenne kcal / 100 g
};

export default function FoodSnap({ today }: { today: string }) {
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

  function injectToMainForm() {
    const kcal = estimatedKcal();
    if (!kcal) return;
    // remplit les champs du formulaire principal existant (même page)
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
          <div className="text-xs" style={{ color: "#6b7280" }}>Détection IA → portion → kcal.</div>
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
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 14 }}>
            IA : <strong>{result.food}</strong>{" "}
            {typeof result.confidence === "number" && `(${Math.round(result.confidence * 100)}%)`}
          </div>

          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
            <label className="label">
              Portion estimée (g)
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
            Les valeurs sont des moyennes — ajuste la portion ou la densité si besoin.
          </div>

          <div style={{ fontSize: 18, fontWeight: 700 }}>
            Total estimé : {estimatedKcal() ?? "—"} kcal
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-dash" disabled={!estimatedKcal()} onClick={injectToMainForm}>
              Remplir le formulaire
            </button>
            <button className="btn" onClick={() => setResult(null)}>
              Réinitialiser
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
