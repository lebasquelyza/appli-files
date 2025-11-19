// apps/web/app/dashboard/calories/FoodSnap.tsx
"use client";
import * as React from "react";
import BarcodeScanner from "./BarcodeScanner";
import { translations } from "@/app/i18n/translations";

type Lang = "fr" | "en";

function getClientLang(): Lang {
  if (typeof document !== "undefined") {
    const m = document.cookie.match(/(?:^|;\s*)fc-lang=(fr|en)/);
    if (m) return m[1] as Lang;
  }
  return "fr";
}

function getFromPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

function t(path: string, fallback: string): string {
  const lang = getClientLang();
  const dict = translations[lang] as any;
  const v = getFromPath(dict, path);
  if (typeof v === "string") return v;
  return fallback;
}

type Candidate = {
  label: string;
  kcal_per_100g: number;
  proteins_g_per_100g: number | null;
  source: "OFF" | "USDA" | "DICT" | "IA";
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

type PlateItem = {
  label: string;
  grams: number;
  kcal_per_100g: number;
  proteins_g_per_100g?: number | null;
  source?: "OFF" | "IA" | "DICT" | "USDA";
};

type PlateResult = {
  items: PlateItem[];
  total_kcal: number;
  total_proteins_g: number | null;
  warnings?: string[];
};

type AnalyzeResponse = ProductResult | PlateResult;

type Props = { today: string; onSave?: (formData: FormData) => Promise<void> };

export default function FoodSnap({ today, onSave }: Props) {
  // ---- Fichier / preview
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  // ---- États communs
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<AnalyzeResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // ---- Produit (vue simple)
  const [portion, setPortion] = React.useState<number>(250);
  const [kcal100, setKcal100] = React.useState<string>("");
  const [prot100, setProt100] = React.useState<string>("");
  const [source, setSource] = React.useState<"OFF" | "IA" | "DICT" | "USDA">("IA");
  const [label, setLabel] = React.useState<string>("");
  const [barcode, setBarcode] = React.useState<string | null>(null);

  // ---- Assiette (vue décomposée)
  const [items, setItems] = React.useState<PlateItem[]>([]);

  // ---- Scanner
  const [showScanner, setShowScanner] = React.useState(false);

  // ---- Recherche manuelle (multi-sources)
  const [q, setQ] = React.useState("");
  const [qLoading, setQLoading] = React.useState(false);
  const [qResults, setQResults] = React.useState<Candidate[]>([]);
  const [qErr, setQErr] = React.useState<string | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);

  /* ---------------- Utils ---------------- */
  function resetAll() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setPortion(250);
    setKcal100("");
    setProt100("");
    setSource("IA");
    setLabel("");
    setBarcode(null);
    setItems([]);
    setQ("");
    setQResults([]);
    setQErr(null);
  }
  function onPick() {
    inputRef.current?.click();
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    resetAll();
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  /* ---------------- Analyse photo (IA) ---------------- */
  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch("/api/food/analyze", { method: "POST", body });
      if (!res.ok)
        throw new Error(
          (await res.text().catch(() => "")) ||
            t("calories.foodSnap.errors.analyzeGeneric", "Analyse impossible")
        );
      const data: AnalyzeResponse = await res.json();
      setResult(data);

      if ("items" in data) {
        // Mode assiette
        setItems(data.items);
      } else {
        // Mode produit
        const top = data.top;
        setLabel(top.label);
        setKcal100(String(top.kcal_per_100g ?? ""));
        setProt100(
          top.proteins_g_per_100g != null ? String(top.proteins_g_per_100g) : ""
        );
        setSource(top.source as any);
        setBarcode(data.barcode || null);
        if (data.net_weight_g && data.net_weight_g > 0)
          setPortion(data.net_weight_g);
      }
    } catch (e: any) {
      setError(
        e?.message ||
          t("calories.foodSnap.errors.unknown", "Erreur inconnue")
      );
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- Scan code-barres (OFF) ---------------- */
  async function fetchOFFByBarcode(scan: string) {
    try {
      const res = await fetch("/api/food/off", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ barcode: scan }),
      });
      let j: any = {};
      try {
        j = await res.json();
      } catch {}
      const c: Candidate | undefined = j?.candidates?.[0];

      if (c) {
        const prod: ProductResult = {
          top: c,
          candidates: [c],
          net_weight_g: null,
          barcode: scan,
          warnings: [],
        };
        setResult(prod);
        setLabel(c.label);
        setKcal100(String(c.kcal_per_100g ?? ""));
        setProt100(
          c.proteins_g_per_100g != null ? String(c.proteins_g_per_100g) : ""
        );
        setSource(c.source);
        setBarcode(scan);
        setError(null);
      } else {
        setError(
          t(
            "calories.foodSnap.errors.offNoProduct",
            "OpenFoodFacts indisponible ou aucun produit. Saisis manuellement ou utilise la photo."
          )
        );
        setResult({
          top: {
            label: "Produit (manuel)",
            kcal_per_100g: 0,
            proteins_g_per_100g: null,
            source: "IA",
          },
          candidates: [],
          net_weight_g: null,
          barcode: scan,
          warnings: [],
        });
      }
    } catch {
      setError(
        t(
          "calories.foodSnap.errors.offUnavailable",
          "OFF non joignable. Essaie plus tard ou saisis manuellement."
        )
      );
    }
  }

  /* ---------------- Recherche “n’importe quel aliment” (OFF+USDA+DICT+IA) ---------------- */
  async function searchAnyFoodByName() {
    const term = q.trim();
    if (!term) return;
    setQLoading(true);
    setQErr(null);
    setQResults([]);
    try {
      const res = await fetch("/api/food/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: term }),
      });
      let j: any = {};
      try {
        j = await res.json();
      } catch {}
      const list: Candidate[] = j?.candidates || [];
      if (!list.length)
        setQErr(
          t(
            "calories.foodSnap.search.noResult",
            "Aucun résultat. Saisis manuellement kcal/100g ou essaie un autre terme."
          )
        );
      setQResults(list);
    } catch {
      setQErr(
        t(
          "calories.foodSnap.search.error",
          "Recherche indisponible. Essaie plus tard ou saisis manuellement."
        )
      );
    } finally {
      setQLoading(false);
    }
  }

  /* ---------------- Totaux ---------------- */
  function totalKcal(): number | null {
    if (!result) return null;
    if ("items" in result) {
      return Math.round(
        items.reduce(
          (s, it) => s + (it.grams * it.kcal_per_100g) / 100,
          0
        )
      );
    }
    const n = Number((kcal100 || "").trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round((n * (portion || 0)) / 100);
  }
  function totalProteins(): number | null {
    if (!result) return null;
    if ("items" in result) {
      const sum = items.reduce(
        (s, it) =>
          s +
          (it.grams *
            Number(it.proteins_g_per_100g || 0)) /
            100,
        0
      );
      return Math.round(sum * 10) / 10;
    }
    const p = Number((prot100 || "").trim());
    if (!Number.isFinite(p) || p < 0) return null;
    return Math.round(((p * (portion || 0)) / 100) * 10) / 10;
  }

  function buildNote(): string {
    if (!result) return "Photo: aliment";
    if ("items" in result) {
      const parts = items
        .slice(0, 4)
        .map((it) => `${it.label} ${it.grams}g`);
      return `Assiette: ` + parts.join(" + ");
    }
    return `Produit: ${
      label || "aliment"
    } ~${portion}g @${kcal100 || "?"}kcal/100g (${source})`;
  }

  function injectToMainForm() {
    const kcal = totalKcal();
    if (!kcal) return;
    const kcalInput =
      document.querySelector<HTMLInputElement>(
        'form[action][method="post"] input[name="kcal"]'
      );
    const noteInput =
      document.querySelector<HTMLInputElement>(
        'form[action][method="post"] input[name="note"]'
      );
    if (kcalInput) kcalInput.value = String(kcal);
    if (noteInput) noteInput.value = buildNote();
    const submit =
      document.querySelector<HTMLButtonElement>(
        'form[action][method="post"] button[type="submit"]'
      );
    submit?.focus();
  }

  /* ---------------- UI ---------------- */
  return (
    <div
      className="card"
      style={{ border: "1px dashed #d1d5db", padding: 12 }}
    >
      {/* En-tête */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{ fontWeight: 600 }}
            dangerouslySetInnerHTML={{
              __html: t(
                "calories.foodSnap.header.title",
                'Ajouter depuis une <u>photo</u>, un <u>code-barres</u> ou une <u>recherche</u>'
              ),
            }}
          />
          <div
            className="text-xs"
            style={{ color: "#6b7280" }}
          >
            {t(
              "calories.foodSnap.header.subtitle",
              "OFF/USDA prioritaire (valeurs réelles), sinon IA/manuel."
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn"
            onClick={onPick}
            style={{ fontSize: 13 }}
          >
            {t("calories.foodSnap.buttons.photo", "📸 Photo")}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => setShowScanner(true)}
            style={{ fontSize: 13 }}
          >
            {t("calories.foodSnap.buttons.scan", "🧾 Scanner")}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          hidden
        />
      </div>

      {/* Scanner */}
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

      {/* Recherche multi-sources */}
      <div
        className="card"
        style={{ marginTop: 10, padding: 10, border: "1px solid #e5e7eb" }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          {t(
            "calories.foodSnap.search.title",
            "Recherche manuelle (OFF + USDA)"
          )}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 8,
          }}
        >
          <input
            className="input"
            type="search"
            placeholder={t(
              "calories.foodSnap.search.placeholder",
              'ex: "riz basmati", "banane", "blanc de poulet", "yaourt grec 0%"'
            )}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            className="btn"
            type="button"
            onClick={searchAnyFoodByName}
            disabled={qLoading}
          >
            {qLoading
              ? t(
                  "calories.foodSnap.search.loading",
                  "Recherche…"
                )
              : t(
                  "calories.foodSnap.search.submit",
                  "Rechercher"
                )}
          </button>
        </div>
        {qErr && (
          <div
            className="text-xs"
            style={{ color: "#dc2626", marginTop: 6 }}
          >
            {qErr}
          </div>
        )}
        {qResults.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: 6,
              marginTop: 8,
            }}
          >
            {qResults.map((c, i) => (
              <div
                key={i}
                className="card"
                style={{
                  padding: 8,
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  className="text-sm"
                  style={{ lineHeight: 1.3 }}
                >
                  <div>
                    <strong>{c.label}</strong>
                    {c.details ? (
                      <>
                        {" "}
                        —{" "}
                        <span
                          className="text-xs"
                          style={{ color: "#6b7280" }}
                        >
                          {c.details}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "#6b7280" }}
                  >
                    {c.kcal_per_100g || "?"} kcal / 100g ·{" "}
                    {c.proteins_g_per_100g ?? "?"} g{" "}
                    {t(
                      "calories.foodSnap.search.proteinsShort",
                      "prot"
                    )}{" "}
                    —{" "}
                    {t(
                      "calories.foodSnap.search.sourceLabel",
                      "Source"
                    )}
                    : {c.source}
                  </div>
                </div>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setResult({
                      top: c,
                      candidates: [c],
                      net_weight_g: null,
                      barcode: null,
                      warnings: [],
                    });
                    setLabel(c.label);
                    setKcal100(String(c.kcal_per_100g ?? ""));
                    setProt100(
                      c.proteins_g_per_100g != null
                        ? String(c.proteins_g_per_100g)
                        : ""
                    );
                    setSource(c.source as any);
                    setBarcode(null);
                  }}
                >
                  {t("calories.foodSnap.search.choose", "Choisir")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo preview */}
      {preview && (
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gap: 8,
          }}
        >
          <img
            src={preview}
            alt={t(
              "calories.foodSnap.preview.alt",
              "prévisualisation"
            )}
            style={{ maxWidth: "100%", borderRadius: 8 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-dash"
              onClick={analyze}
              disabled={loading}
            >
              {loading
                ? t(
                    "calories.foodSnap.preview.analyzeLoading",
                    "Analyse…"
                  )
                : t(
                    "calories.foodSnap.preview.analyze",
                    "Analyser la photo"
                  )}
            </button>
            <button
              className="btn"
              onClick={resetAll}
            >
              {t(
                "calories.foodSnap.preview.reset",
                "Réinitialiser"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div
          className="text-xs"
          style={{ color: "#dc2626", marginTop: 8 }}
        >
          {error}
        </div>
      )}

      {/* Résultat */}
      {result && (
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gap: 12,
          }}
        >
          {/* Assiette */}
          {"items" in result ? (
            <>
              {!!result.warnings?.length && (
                <div
                  className="text-xs"
                  style={{
                    color: "#92400e",
                    background: "#fef3c7",
                    border: "1px solid #f59e0b55",
                    padding: 8,
                    borderRadius: 6,
                  }}
                >
                  {result.warnings.join(" · ")}
                </div>
              )}
              <div style={{ fontWeight: 600 }}>
                {t(
                  "calories.foodSnap.plate.title",
                  "Décomposition de l’assiette (éditable)"
                )}
              </div>
              <div
                style={{ display: "grid", gap: 8 }}
              >
                {items.map((it, idx) => {
                  const kcal = Math.round(
                    (it.grams * it.kcal_per_100g) / 100
                  );
                  const prot =
                    Math.round(
                      ((it.grams *
                        Number(
                          it.proteins_g_per_100g || 0
                        )) /
                        100) *
                        10
                    ) / 10;
                  return (
                    <div
                      key={idx}
                      className="card"
                      style={{
                        padding: 8,
                        display: "grid",
                        gridTemplateColumns:
                          "1fr 110px 110px 110px auto 36px",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontSize: 14 }}>
                        {it.label}
                      </div>
                      <label
                        className="label"
                        style={{ margin: 0 }}
                      >
                        {t(
                          "calories.foodSnap.plate.grams",
                          "Grammes"
                        )}
                        <input
                          className="input"
                          type="number"
                          min={1}
                          step={1}
                          value={it.grams}
                          onChange={(e) =>
                            setItems((b) =>
                              b.map((x, i) =>
                                i === idx
                                  ? {
                                      ...x,
                                      grams: Number(
                                        e.target.value
                                      ),
                                    }
                                  : x
                              )
                            )
                          }
                        />
                      </label>
                      <label
                        className="label"
                        style={{ margin: 0 }}
                      >
                        {t(
                          "calories.foodSnap.plate.kcalPer100",
                          "kcal/100g"
                        )}
                        <input
                          className="input"
                          type="number"
                          min={1}
                          step={1}
                          value={it.kcal_per_100g}
                          onChange={(e) =>
                            setItems((b) =>
                              b.map((x, i) =>
                                i === idx
                                  ? {
                                      ...x,
                                      kcal_per_100g:
                                        Number(
                                          e.target
                                            .value
                                        ),
                                    }
                                  : x
                              )
                            )
                          }
                        />
                      </label>
                      <label
                        className="label"
                        style={{ margin: 0 }}
                      >
                        {t(
                          "calories.foodSnap.plate.protPer100",
                          "Prot/100g"
                        )}
                        <input
                          className="input"
                          type="number"
                          min={0}
                          step="0.1"
                          value={
                            it.proteins_g_per_100g ??
                            0
                          }
                          onChange={(e) =>
                            setItems((b) =>
                              b.map((x, i) =>
                                i === idx
                                  ? {
                                      ...x,
                                      proteins_g_per_100g:
                                        Number(
                                          e.target
                                            .value
                                        ),
                                    }
                                  : x
                              )
                            )
                          }
                        />
                      </label>
                      <div
                        className="text-xs"
                        style={{
                          textAlign: "right",
                          fontFamily:
                            "tabular-nums",
                        }}
                      >
                        {kcal} kcal · {prot}{" "}
                        {t(
                          "calories.foodSnap.plate.proteinsShort",
                          "g prot"
                        )}
                      </div>
                      <button
                        className="btn"
                        onClick={() =>
                          setItems((b) =>
                            b.filter(
                              (_, i) => i !== idx
                            )
                          )
                        }
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontWeight: 700 }}>
                {t(
                  "calories.foodSnap.plate.total",
                  "Total"
                )}{" "}
                : {totalKcal() ?? "—"} kcal ·{" "}
                {totalProteins() ?? "—"}{" "}
                {t(
                  "calories.foodSnap.plate.totalProteinsShort",
                  "g protéines"
                )}
              </div>
            </>
          ) : (
            // Produit
            <>
              {!!result.warnings?.length && (
                <div
                  className="text-xs"
                  style={{
                    color: "#92400e",
                    background: "#fef3c7",
                    border: "1px solid #f59e0b55",
                    padding: 8,
                    borderRadius: 6,
                  }}
                >
                  {result.warnings.join(" · ")}
                </div>
              )}
              <div style={{ fontSize: 14 }}>
                <strong>
                  {t(
                    "calories.foodSnap.product.title",
                    "Produit"
                  )}
                </strong>
                {" : "}
                {label}
                {barcode ? (
                  <span
                    className="text-xs"
                    style={{ color: "#6b7280" }}
                  >
                    {" "}
                    — {barcode}
                  </span>
                ) : null}
              </div>
              <div
                className="text-xs"
                style={{ color: "#6b7280" }}
              >
                {t(
                  "calories.foodSnap.product.sourceLabel",
                  "Source"
                )}{" "}
                : <strong>{source}</strong>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns:
                    "1fr 1fr 1fr",
                  alignItems: "end",
                }}
              >
                <label className="label">
                  {t(
                    "calories.foodSnap.product.portion",
                    "Portion (g)"
                  )}
                  <input
                    className="input"
                    type="number"
                    min={1}
                    step={1}
                    value={portion}
                    onChange={(e) =>
                      setPortion(
                        Number(e.target.value)
                      )
                    }
                  />
                </label>
                <label className="label">
                  {t(
                    "calories.foodSnap.product.kcalPer100",
                    "kcal / 100 g"
                  )}
                  <input
                    className="input"
                    type="number"
                    min={1}
                    step={1}
                    value={kcal100}
                    onChange={(e) =>
                      setKcal100(e.target.value)
                    }
                  />
                </label>
                <label className="label">
                  {t(
                    "calories.foodSnap.product.protPer100",
                    "Prot / 100 g"
                  )}
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step="0.1"
                    value={prot100}
                    onChange={(e) =>
                      setProt100(e.target.value)
                    }
                  />
                </label>
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                {t(
                  "calories.foodSnap.product.total",
                  "Total"
                )}{" "}
                : {totalKcal() ?? "—"} kcal ·{" "}
                {totalProteins() ?? "—"}{" "}
                {t(
                  "calories.foodSnap.product.totalProteinsShort",
                  "g protéines"
                )}
              </div>
            </>
          )}

          <div
            className="text-xs"
            style={{ color: "#6b7280" }}
          >
            {t(
              "calories.foodSnap.help.manual",
              "⚡ Si aucune base ne répond, tu peux saisir les valeurs manuellement (kcal/prot pour 100 g), puis indiquer la portion."
            )}
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <button
              className="btn"
              onClick={injectToMainForm}
              disabled={!totalKcal()}
            >
              {t(
                "calories.foodSnap.actions.fillForm",
                "Remplir le formulaire en haut"
              )}
            </button>
            {onSave && (
              <form
                action={onSave}
                style={{
                  display: "inline-flex",
                  gap: 8,
                }}
              >
                <input
                  type="hidden"
                  name="date"
                  value={today}
                />
                <input
                  type="hidden"
                  name="kcal"
                  value={totalKcal() ?? 0}
                />
                <input
                  type="hidden"
                  name="note"
                  value={buildNote()}
                />
                <button
                  className="btn btn-dash"
                  type="submit"
                  disabled={!totalKcal()}
                >
                  {t(
                    "calories.foodSnap.actions.addToCalories",
                    "Ajouter à mes calories"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

