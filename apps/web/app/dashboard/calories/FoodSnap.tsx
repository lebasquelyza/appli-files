"use client";
import * as React from "react";
import BarcodeScanner from "./BarcodeScanner"; // NEW

type Candidate = {
  label: string;
  kcal_per_100g: number;
  proteins_g_per_100g: number | null;
  source: "OFF" | "IA" | "DICT";
  details?: string;
  confidence?: number;
};
type ProductResult = {
  top: Candidate;
  candidates: Candidate[];
  net_weight_g?: number | null;
  barcode?: string | null;
  warnings?: string[];
};
type PlateItem = { label: string; grams: number; kcal_per_100g: number; proteins_g_per_100g?: number | null; source?: "OFF" | "IA" | "DICT" };
type PlateResult = { items: PlateItem[]; total_kcal: number; total_proteins_g: number | null; warnings?: string[] };
type AnalyzeResponse = ProductResult | PlateResult;

type Props = { today: string; onSave?: (formData: FormData) => Promise<void> };

export default function FoodSnap({ today, onSave }: Props) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<AnalyzeResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Produit
  const [portion, setPortion] = React.useState<number>(250);
  const [kcal100, setKcal100] = React.useState<string>("");
  const [prot100, setProt100] = React.useState<string>("");
  const [source, setSource] = React.useState<"OFF" | "IA" | "DICT">("IA");
  const [label, setLabel] = React.useState<string>("");
  const [barcode, setBarcode] = React.useState<string | null>(null); // NEW

  // Assiette
  const [items, setItems] = React.useState<PlateItem[]>([]);

  // Scanner UI
  const [showScanner, setShowScanner] = React.useState(false); // NEW

  const inputRef = React.useRef<HTMLInputElement>(null);

  function resetAll() {
    setFile(null); setPreview(null); setResult(null); setError(null);
    setPortion(250); setKcal100(""); setProt100(""); setSource("IA"); setLabel(""); setBarcode(null);
    setItems([]);
  }
  function onPick() { inputRef.current?.click(); }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    resetAll();
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function analyze() {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const body = new FormData(); body.append("image", file);
      const res = await fetch("/api/food/analyze", { method: "POST", body });
      if (!res.ok) throw new Error((await res.text().catch(()=> "")) || "Analyse impossible");
      const data: AnalyzeResponse = await res.json();
      setResult(data);

      if ("items" in data) {
        setItems(data.items);
      } else {
        const top = data.top;
        setLabel(top.label);
        setKcal100(String(top.kcal_per_100g ?? ""));
        setProt100(top.proteins_g_per_100g != null ? String(top.proteins_g_per_100g) : "");
        setSource(top.source);
        setBarcode(data.barcode || null);
        if (data.net_weight_g && data.net_weight_g > 0) setPortion(data.net_weight_g);
      }
    } catch (e: any) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  // NEW — récupération OFF directe par barcode (bypass vision)
  async function fetchOFFByBarcode(scan: string) {
    try {
      const res = await fetch("/api/food/off", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ barcode: scan }),
      });
      if (!res.ok) throw new Error("OFF indisponible");
      const j = await res.json();
      const c: Candidate | undefined = j?.candidates?.[0];
      if (c) {
        setResult({
          top: c,
          candidates: [c],
          net_weight_g: null,
          barcode: scan,
          warnings: [],
        });
        setLabel(c.label);
        setKcal100(String(c.kcal_per_100g ?? ""));
        setProt100(c.proteins_g_per_100g != null ? String(c.proteins_g_per_100g) : "");
        setSource("OFF");
        setBarcode(scan);
      } else {
        setError("Aucune fiche OFF pour ce code-barres");
      }
    } catch (e: any) {
      setError(e?.message || "Erreur OFF");
    }
  }

  // Totaux
  function totalKcal(): number | null {
    if (!result) return null;
    if ("items" in result) return Math.round(items.reduce((s, it) => s + (it.grams * it.kcal_per_100g) / 100, 0));
    const n = Number((kcal100 || "").trim()); if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round((n * (portion || 0)) / 100);
  }
  function totalProteins(): number | null {
    if (!result) return null;
    if ("items" in result) {
      const sum = items.reduce((s, it) => s + (it.grams * (Number(it.proteins_g_per_100g || 0))) / 100, 0);
      return Math.round(sum * 10) / 10;
    }
    const p = Number((prot100 || "").trim()); if (!Number.isFinite(p) || p < 0) return null;
    return Math.round(((p * (portion || 0)) / 100) * 10) / 10;
  }

  function buildNote(): string {
    if (!result) return "Photo: aliment";
    if ("items" in result) {
      const parts = items.slice(0, 4).map(it => `${it.label} ${it.grams}g`);
      return (`Assiette: ` + parts.join(" + ")).slice(0, 120);
    }
    return `Photo: ${label || "aliment"} ~${portion}g @${kcal100 || "?"}kcal/100g (${source})`.slice(0, 120);
  }

  function injectToMainForm() {
    const kcal = totalKcal(); if (!kcal) return;
    const kcalInput = document.querySelector<HTMLInputElement>('form[action][method="post"] input[name="kcal"]');
    const noteInput = document.querySelector<HTMLInputElement>('form[action][method="post"] input[name="note"]');
    if (kcalInput) kcalInput.value = String(kcal);
    if (noteInput) noteInput.value = buildNote();
    const submit = document.querySelector<HTMLButtonElement>('form[action][method="post"] button[type="submit"]');
    submit?.focus();
  }

  return (
    <div className="card" style={{ border: "1px dashed #d1d5db", padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }}>Photo d’un aliment / assiette</div>
          <div className="text-xs" style={{ color: "#6b7280" }}>OFF (code-barres) prioritaire, sinon IA (ajustable).</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={onPick} style={{ fontSize: 13 }}>📸 Prendre/Choisir</button>
          <button className="btn" type="button" onClick={() => setShowScanner(true)} style={{ fontSize: 13 }}>🧾 Scanner code-barres</button> {/* NEW */}
        </div>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
      </div>

      {/* NEW — Panneau scanner */}
      {showScanner && (
        <div style={{ marginTop: 10 }}>
          <BarcodeScanner
            onDetected={(code) => {
              setShowScanner(false);
              setBarcode(code);
              fetchOFFByBarcode(code);
            }}
            onClose={() => setShowScanner(false)}
          />
        </div>
      )}

      {preview && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <img src={preview} alt="prévisualisation" style={{ maxWidth: "100%", borderRadius: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-dash" onClick={analyze} disabled={loading}>{loading ? "Analyse…" : "Analyser la photo"}</button>
            <button className="btn" onClick={resetAll}>Changer de photo</button>
          </div>
        </div>
      )}

      {error && <div className="text-xs" style={{ color: "#dc2626", marginTop: 8 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
          {"items" in result ? (
            <>
              {result.warnings?.length ? (
                <div className="text-xs" style={{ color: "#92400e", background: "#fef3c7", border: "1px solid #f59e0b55", padding: 8, borderRadius: 6 }}>
                  {result.warnings.join(" · ")}
                </div>
              ) : null}
              <div style={{ fontWeight: 600 }}>Décomposition de l’assiette (éditable)</div>
              <div style={{ display: "grid", gap: 8 }}>
                {items.map((it, idx) => {
                  const kcal = Math.round((it.grams * it.kcal_per_100g) / 100);
                  const prot = Math.round(((it.grams * (Number(it.proteins_g_per_100g || 0))) / 100) * 10) / 10;
                  return (
                    <div key={idx} className="card" style={{ padding: 8, display: "grid", gridTemplateColumns: "1fr 110px 110px 110px 160px 36px", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 14 }}>{it.label}</div>
                      <label className="label" style={{ margin: 0 }}>Grammes
                        <input className="input" type="number" min={1} step={1} value={it.grams}
                          onChange={(e) => setItems(b => b.map((x,i)=> i===idx ? { ...x, grams: Number(e.target.value) } : x))} />
                      </label>
                      <label className="label" style={{ margin: 0 }}>kcal/100g
                        <input className="input" type="number" min={1} step={1} value={it.kcal_per_100g}
                          onChange={(e) => setItems(b => b.map((x,i)=> i===idx ? { ...x, kcal_per_100g: Number(e.target.value) } : x))} />
                      </label>
                      <label className="label" style={{ margin: 0 }}>Prot/100g
                        <input className="input" type="number" min={0} step="0.1" value={it.proteins_g_per_100g ?? 0}
                          onChange={(e) => setItems(b => b.map((x,i)=> i===idx ? { ...x, proteins_g_per_100g: Number(e.target.value) } : x))} />
                      </label>
                      <div className="text-xs" style={{ color: "#6b7280" }}>
                        Source : {it.source || "IA"}
                      </div>
                      <div style={{ textAlign: "right", fontFamily: "tabular-nums" }}>
                        {kcal} kcal · {prot} g prot
                      </div>
                      <button className="btn" onClick={() => setItems(b => b.filter((_,i)=>i!==idx))}>✕</button>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontWeight: 700 }}>
                Total : {totalKcal() ?? "—"} kcal · {totalProteins() ?? "—"} g protéines
              </div>
            </>
          ) : (
            <>
              {result.warnings?.length ? (
                <div className="text-xs" style={{ color: "#92400e", background: "#fef3c7", border: "1px solid #f59e0b55", padding: 8, borderRadius: 6 }}>
                  {result.warnings.join(" · ")}
                </div>
              ) : null}

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 14 }}>
                  <strong>Aliment</strong> : {label}
                  {barcode ? <span className="text-xs" style={{ color: "#6b7280" }}> — code-barres: {barcode}</span> : null}
                </div>
                <div className="text-xs" style={{ color: "#6b7280" }}>
                  Source : <strong>{source}</strong>{("candidates" in result) && result.candidates.length > 1 ? " · change ci-dessous si besoin" : ""}
                </div>

                {"candidates" in result && result.candidates?.length > 1 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {result.candidates.map((c, i) => (
                      <button
                        key={i}
                        className="btn"
                        type="button"
                        style={{ fontSize: 12 }}
                        onClick={() => {
                          setLabel(c.label);
                          setKcal100(String(c.kcal_per_100g ?? ""));
                          setProt100(c.proteins_g_per_100g != null ? String(c.proteins_g_per_100g) : "");
                          setSource(c.source);
                        }}
                      >
                        {c.source} · {c.kcal_per_100g || "?"} kcal / {c.proteins_g_per_100g ?? "?"} g prot
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr", alignItems: "end" }}>
                  <label className="label">Portion (g)
                    <input className="input" type="number" min={1} step={1} value={portion} onChange={(e) => setPortion(Number(e.target.value))} />
                  </label>
                  <label className="label">kcal / 100 g
                    <input className="input" type="number" min={1} step={1} value={kcal100} onChange={(e) => setKcal100(e.target.value)} />
                  </label>
                  <label className="label">Prot / 100 g
                    <input className="input" type="number" min={0} step="0.1" value={prot100} onChange={(e) => setProt100(e.target.value)} />
                  </label>
                </div>

                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  Total : {totalKcal() ?? "—"} kcal · {totalProteins() ?? "—"} g protéines
                </div>
              </div>
            </>
          )}

          <div className="text-xs" style={{ color: "#6b7280" }}>
            <strong>Valeurs :</strong> si un code-barres est scanné, les données viennent d’OpenFoodFacts (réelles, par 100 g). Sinon, estimation IA ajustable.  
            Pense à vérifier <em>cru vs cuit</em> et sauces/huile.
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button className="btn" onClick={injectToMainForm} disabled={!totalKcal()}>
              Remplir le formulaire en haut
            </button>
            {onSave && (
              <form action={onSave} style={{ display: "inline-flex", gap: 8 }}>
                <input type="hidden" name="date" value={today} />
                <input type="hidden" name="kcal" value={totalKcal() ?? 0} />
                <input type="hidden" name="note" value={buildNote()} />
                <button className="btn btn-dash" type="submit" disabled={!totalKcal()}>
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
