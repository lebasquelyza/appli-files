// apps/web/app/dashboard/calories/FoodSnap.tsx
"use client";
import * as React from "react";

type AnalyzeItem = { label: string; grams: number; kcal_per_100g: number };
type AnalyzeResponse =
  | {
      // Produit emballé
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
      items?: undefined;
      total_kcal?: undefined;
    }
  | {
      // Assiette (multi-ingrédients)
      items: AnalyzeItem[];
      total_kcal: number;
      food?: undefined;
      confidence?: undefined;
      kcal_per_100g?: undefined;
      net_weight_g?: undefined;
      nutrition?: undefined;
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
  const [error, setError] = React.useState<string | null>(null);

  // État “produit”
  const [portion, setPortion] = React.useState<number>(250);
  const [portionAuto, setPortionAuto] = React.useState<null | number>(null);
  const [kcal100, setKcal100] = React.useState<string>("");

  // État “assiette”
  const [items, setItems] = React.useState<AnalyzeItem[]>([]);

  const inputRef = React.useRef<HTMLInputElement>(null);

  function onPick() { inputRef.current?.click(); }
  function resetAll() {
    setFile(null); setPreview(null); setResult(null); setError(null);
    setPortion(250); setPortionAuto(null); setKcal100("");
    setItems([]);
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    resetAll();
    setFile(f);
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

      if ("items" in data && Array.isArray(data.items)) {
        // Mode ASSIETTE
        setItems(data.items);
      } else {
        // Mode PRODUIT
        setKcal100(String((data as any).kcal_per_100g || ""));
        const auto = (data as any).net_weight_g;
        if (typeof auto === "number" && auto > 0) {
          setPortion(auto); setPortionAuto(auto);
        }
      }
    } catch (e: any) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  // Totaux
  function totalKcal(): number | null {
    if (!result) return null;
    if ("items" in result) {
      return Math.round(items.reduce((s, it) => s + (it.grams * it.kcal_per_100g) / 100, 0));
    }
    const n = Number((kcal100 || "").trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round((n * (portion || 0)) / 100);
  }

  // Note compacte pour l'action serveur (max ~120 chars, mais l'action tronque aussi)
  function buildNote(): string {
    if (!result) return "Photo: aliment";
    if ("items" in result) {
      const parts = items.slice(0, 5).map(it => `${it.label} ${it.grams}g`);
      return (`Photo assiette: ` + parts.join(" + ")).slice(0, 120);
    }
    const conf = typeof (result as any).confidence === "number" ? ` (${Math.round(((result as any).confidence) * 100)}%)` : "";
    const label = (result as any).food || "aliment";
    return `Photo: ${label} ~${portion}g @${kcal100 || "?"}kcal/100g${conf}`.slice(0, 120);
  }

  function injectToMainForm() {
    const kcal = totalKcal();
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
          <div style={{ fontWeight: 600 }}>Prendre une photo d’un aliment / assiette</div>
          <div className="text-xs" style={{ color: "#6b7280" }}>Étiquette (poids net) ou assiette (décomposition ingrédients).</div>
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
            <button className="btn" onClick={resetAll}>Changer de photo</button>
          </div>
        </div>
      )}

      {error && <div className="text-xs" style={{ color: "#dc2626", marginTop: 8 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
          {/* Cas ASSIETTE */}
          {"items" in result ? (
            <>
              <div style={{ fontWeight: 600 }}>Décomposition de l’assiette (éditable)</div>
              <div style={{ display: "grid", gap: 8 }}>
                {items.map((it, idx) => (
                  <div key={idx} className="card" style={{ padding: 8, display: "grid", gridTemplateColumns: "1fr 110px 110px 90px 36px", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 14 }}>{it.label}</div>
                    <label className="label" style={{ margin: 0 }}>Grammes
                      <input className="input" type="number" min={1} step={1} value={it.grams}
                        onChange={(e) => setItems(b => b.map((x,i)=> i===idx ? { ...x, grams: Number(e.target.value) } : x))} />
                    </label>
                    <label className="label" style={{ margin: 0 }}>kcal/100g
                      <input className="input" type="number" min={1} step={1} value={it.kcal_per_100g}
                        onChange={(e) => setItems(b => b.map((x,i)=> i===idx ? { ...x, kcal_per_100g: Number(e.target.value) } : x))} />
                    </label>
                    <div style={{ textAlign: "right", fontFamily: "tabular-nums" }}>
                      {Math.round((it.grams * it.kcal_per_100g)/100)} kcal
                    </div>
                    <button className="btn" onClick={() => setItems(b => b.filter((_,i)=>i!==idx))}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ fontWeight: 700 }}>
                Total estimé : {totalKcal() ?? "—"} kcal
              </div>
            </>
          ) : (
            // Cas PRODUIT
            <>
              <div style={{ fontSize: 14, lineHeight: 1.4 }}>
                <div><strong>Aliment</strong> : {(result as any).food}</div>
                <div><strong>Confiance</strong> : {typeof (result as any).confidence === "number" ? `${Math.round(((result as any).confidence) * 100)}%` : "—"}</div>
                <div><strong>kcal / 100 g</strong> : {kcal100 || "—"}</div>
              </div>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr", alignItems: "end" }}>
                <label className="label">
                  Portion (g)
                  <input className="input" type="number" min={1} step={1} value={portion} onChange={(e) => setPortion(Number(e.target.value))} />
                </label>
                <div className="text-xs" style={{ color: "#6b7280" }}>
                  {portionAuto ? <>Détecté depuis l’étiquette : <strong>{portionAuto} g</strong></> : "Régle la portion si besoin"}
                </div>
                <label className="label">
                  kcal / 100 g
                  <input className="input" type="number" min={1} step={1} value={kcal100} onChange={(e) => setKcal100(e.target.value)} />
                </label>
                <div className="text-xs" style={{ color: "#6b7280" }}>
                  Valeur issue de l’étiquette si visible — sinon estimation IA.
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                Total estimé : {totalKcal() ?? "—"} kcal
              </div>
            </>
          )}

          <div className="text-sm" style={{ color: "#6b7280" }}>
            Ajuste si besoin : l’estimation dépend de la recette, de la cuisson et du cadrage de la photo.
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
