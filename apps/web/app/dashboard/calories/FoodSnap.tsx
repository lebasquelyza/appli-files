// apps/web/app/dashboard/calories/FoodSnap.tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
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
function t(path: string): string {
  const lang = getClientLang();
  const dict = translations[lang] as any;
  const v = getFromPath(dict, path);
  if (typeof v === "string") return v;
  return path;
}
function tf(path: string, fallback: string) {
  const v = t(path);
  return v === path ? fallback : v;
}

type NutrPer100 = {
  kcal_per_100g: number;
  proteins_g_per_100g: number | null;
  carbs_g_per_100g?: number | null;
  fats_g_per_100g?: number | null;
  fibers_g_per_100g?: number | null;
  sugars_g_per_100g?: number | null;
  salt_g_per_100g?: number | null;
};

type Candidate = {
  label: string;
  source?: "OFF" | "USDA" | "DICT" | "IA";
  details?: string;
  confidence?: number;
} & NutrPer100;

type PlateItemEstimated = {
  label: string;
  grams_estimated: number;
  source?: "OFF" | "IA" | "DICT" | "USDA";
} & NutrPer100;

type PlateItemConfirmed = {
  label: string;
  grams: number;
  source?: "OFF" | "IA" | "DICT" | "USDA";
} & NutrPer100;

type AnalyzeProductResult = {
  kind: "product";
  needs_user_confirmation: true;
  top: Candidate;
  candidates: Candidate[];
  net_weight_g?: number | null;
  barcode?: string | null;
  portion_estimated_g: number;
  warnings?: string[];
};

type AnalyzePlateResult = {
  kind: "plate";
  needs_user_confirmation: true;
  items: PlateItemEstimated[];
  warnings?: string[];
};

type AnalyzeResponse = AnalyzeProductResult | AnalyzePlateResult;

type ConfirmPlateResponse = {
  kind: "plate";
  confirmed: true;
  items: PlateItemConfirmed[];
  total_kcal: number;
  total_proteins_g: number;
  total_carbs_g?: number;
  total_fats_g?: number;
  total_fibers_g?: number;
  total_sugars_g?: number;
  total_salt_g?: number;
};

type ConfirmProductResponse = {
  kind: "product";
  confirmed: true;
  label: string;
  grams: number;
  total_kcal: number;
  total_proteins_g: number | null;
  total_carbs_g?: number | null;
  total_fats_g?: number | null;
  total_fibers_g?: number | null;
  total_sugars_g?: number | null;
  total_salt_g?: number | null;
  source?: string | null;
  barcode?: string | null;
};

type ConfirmResponse = ConfirmPlateResponse | ConfirmProductResponse;

// ✅ onSave retourne maintenant un objet { ok: true } ou { ok:false, error: ... }
type SaveResult = { ok: true } | { ok: false; error: string };

type Props = { today: string; onSave?: (formData: FormData) => Promise<SaveResult> };

function round1(x: number) {
  return Math.round(x * 10) / 10;
}
function numOrNull(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export default function FoodSnap({ today, onSave }: Props) {
  const router = useRouter();

  // ---- Fichier / preview
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  // ---- États
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<AnalyzeResponse | null>(null);
  const [confirmed, setConfirmed] = React.useState<ConfirmResponse | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ✅ auto save (sans redirect)
  const [autoSaving, setAutoSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);

  // ---- Produit (édition)
  const [portion, setPortion] = React.useState<number>(250);
  const [kcal100, setKcal100] = React.useState<string>("");
  const [prot100, setProt100] = React.useState<string>("");
  const [carb100, setCarb100] = React.useState<string>("");
  const [fat100, setFat100] = React.useState<string>("");
  const [fiber100, setFiber100] = React.useState<string>("");
  const [sugar100, setSugar100] = React.useState<string>("");
  const [salt100, setSalt100] = React.useState<string>("");

  const [label, setLabel] = React.useState<string>("");
  const [barcode, setBarcode] = React.useState<string | null>(null);

  // ---- Assiette (édition)
  const [items, setItems] = React.useState<PlateItemConfirmed[]>([]);

  // ---- Scanner
  const [showScanner, setShowScanner] = React.useState(false);

  // ---- Recherche manuelle
  const [q, setQ] = React.useState("");
  const [qLoading, setQLoading] = React.useState(false);
  const [qResults, setQResults] = React.useState<Candidate[]>([]);
  const [qErr, setQErr] = React.useState<string | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);

  function resetAll() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setConfirmed(null);
    setConfirming(false);
    setError(null);

    setAutoSaving(false);
    setSaveMsg(null);

    setPortion(250);
    setKcal100("");
    setProt100("");
    setCarb100("");
    setFat100("");
    setFiber100("");
    setSugar100("");
    setSalt100("");

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

  function applyCandidateToProduct(c: Candidate) {
    setLabel(c.label);
    setKcal100(String(c.kcal_per_100g ?? ""));
    setProt100(c.proteins_g_per_100g != null ? String(c.proteins_g_per_100g) : "");
    setCarb100(c.carbs_g_per_100g != null ? String(c.carbs_g_per_100g) : "");
    setFat100(c.fats_g_per_100g != null ? String(c.fats_g_per_100g) : "");
    setFiber100(c.fibers_g_per_100g != null ? String(c.fibers_g_per_100g) : "");
    setSugar100(c.sugars_g_per_100g != null ? String(c.sugars_g_per_100g) : "");
    setSalt100(c.salt_g_per_100g != null ? String(c.salt_g_per_100g) : "");
    setConfirmed(null);
    setSaveMsg(null);
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setConfirmed(null);
    setSaveMsg(null);

    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch("/api/food/analyze", { method: "POST", body });
      if (!res.ok) {
        throw new Error((await res.text().catch(() => "")) || t("calories.foodSnap.errors.analyzeGeneric"));
      }
      const data: AnalyzeResponse = await res.json();
      setResult(data);

      if (data.kind === "plate") {
        setItems(
          (data.items || []).map((it) => ({
            label: it.label,
            grams: it.grams_estimated,
            kcal_per_100g: it.kcal_per_100g,
            proteins_g_per_100g: it.proteins_g_per_100g ?? null,
            carbs_g_per_100g: it.carbs_g_per_100g ?? null,
            fats_g_per_100g: it.fats_g_per_100g ?? null,
            fibers_g_per_100g: it.fibers_g_per_100g ?? null,
            sugars_g_per_100g: it.sugars_g_per_100g ?? null,
            salt_g_per_100g: it.salt_g_per_100g ?? null,
          }))
        );
      } else {
        applyCandidateToProduct(data.top);
        setBarcode(data.barcode || null);
        setPortion(data.portion_estimated_g || 250);
      }
    } catch (e: any) {
      setError(e?.message || t("calories.foodSnap.errors.unknown"));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

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
        const prod: AnalyzeProductResult = {
          kind: "product",
          needs_user_confirmation: true,
          top: c,
          candidates: [c],
          net_weight_g: null,
          barcode: scan,
          portion_estimated_g: portion || 250,
          warnings: [],
        };
        setResult(prod);
        setConfirmed(null);

        applyCandidateToProduct(c);
        setBarcode(scan);
        setError(null);
      } else {
        setError(t("calories.foodSnap.errors.offNoProduct"));
      }
    } catch {
      setError(t("calories.foodSnap.errors.offUnavailable"));
    }
  }

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
      if (!list.length) setQErr(t("calories.foodSnap.search.noResult"));
      setQResults(list);
    } catch {
      setQErr(t("calories.foodSnap.search.error"));
    } finally {
      setQLoading(false);
    }
  }

  function estimateTotalsFromItems(list: PlateItemConfirmed[]) {
    const sum = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, sug: 0, salt: 0 };
    for (const it of list) {
      const g = Number(it.grams || 0);
      sum.kcal += (g * Number(it.kcal_per_100g || 0)) / 100;
      if (it.proteins_g_per_100g != null) sum.p += (g * Number(it.proteins_g_per_100g)) / 100;
      if (it.carbs_g_per_100g != null) sum.c += (g * Number(it.carbs_g_per_100g)) / 100;
      if (it.fats_g_per_100g != null) sum.f += (g * Number(it.fats_g_per_100g)) / 100;
      if (it.fibers_g_per_100g != null) sum.fib += (g * Number(it.fibers_g_per_100g)) / 100;
      if (it.sugars_g_per_100g != null) sum.sug += (g * Number(it.sugars_g_per_100g)) / 100;
      if (it.salt_g_per_100g != null) sum.salt += (g * Number(it.salt_g_per_100g)) / 100;
    }
    return {
      total_kcal: Math.round(sum.kcal),
      total_proteins_g: round1(sum.p),
      total_carbs_g: round1(sum.c),
      total_fats_g: round1(sum.f),
      total_fibers_g: round1(sum.fib),
      total_sugars_g: round1(sum.sug),
      total_salt_g: Math.round(sum.salt * 100) / 100,
    };
  }

  function estimateTotalsFromProduct() {
    const g = Number(portion || 0);
    const kcal = Number((kcal100 || "").trim() || 0);
    if (!Number.isFinite(g) || g <= 0 || !Number.isFinite(kcal) || kcal <= 0) return null;

    const p100 = numOrNull((prot100 || "").trim());
    const c100 = numOrNull((carb100 || "").trim());
    const f100 = numOrNull((fat100 || "").trim());
    const fi100 = numOrNull((fiber100 || "").trim());
    const su100 = numOrNull((sugar100 || "").trim());
    const sa100 = numOrNull((salt100 || "").trim());

    return {
      total_kcal: Math.round((g * kcal) / 100),
      total_proteins_g: p100 != null ? round1((g * p100) / 100) : null,
      total_carbs_g: c100 != null ? round1((g * c100) / 100) : null,
      total_fats_g: f100 != null ? round1((g * f100) / 100) : null,
      total_fibers_g: fi100 != null ? round1((g * fi100) / 100) : null,
      total_sugars_g: su100 != null ? round1((g * su100) / 100) : null,
      total_salt_g: sa100 != null ? Math.round(((g * sa100) / 100) * 100) / 100 : null,
    };
  }

  async function confirmAndCompute() {
    if (!result) return;
    setConfirming(true);
    setError(null);
    setSaveMsg(null);

    try {
      let payload: any = null;

      if (result.kind === "plate") {
        payload = {
          kind: "plate",
          items: items.map((it) => ({
            label: it.label,
            grams: Number(it.grams || 0),
            kcal_per_100g: Number(it.kcal_per_100g || 0),
            proteins_g_per_100g: it.proteins_g_per_100g ?? null,
            carbs_g_per_100g: it.carbs_g_per_100g ?? null,
            fats_g_per_100g: it.fats_g_per_100g ?? null,
            fibers_g_per_100g: it.fibers_g_per_100g ?? null,
            sugars_g_per_100g: it.sugars_g_per_100g ?? null,
            salt_g_per_100g: it.salt_g_per_100g ?? null,
          })),
        };
      } else {
        payload = {
          kind: "product",
          label: label || result.top.label,
          grams: Number(portion || 0),
          kcal_per_100g: Number((kcal100 || "").trim() || 0),
          proteins_g_per_100g: (prot100 || "").trim() === "" ? null : Number((prot100 || "").trim()),
          carbs_g_per_100g: (carb100 || "").trim() === "" ? null : Number((carb100 || "").trim()),
          fats_g_per_100g: (fat100 || "").trim() === "" ? null : Number((fat100 || "").trim()),
          fibers_g_per_100g: (fiber100 || "").trim() === "" ? null : Number((fiber100 || "").trim()),
          sugars_g_per_100g: (sugar100 || "").trim() === "" ? null : Number((sugar100 || "").trim()),
          salt_g_per_100g: (salt100 || "").trim() === "" ? null : Number((salt100 || "").trim()),
          barcode,
        };
      }

      const res = await fetch("/api/food/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error((await res.text().catch(() => "")) || "confirm_failed");

      const data: ConfirmResponse = await res.json();
      setConfirmed(data);

      // ✅ AUTO: sauvegarde immédiate (sans redirect) + refresh de la page
      if (onSave && data.confirmed && data.total_kcal && !autoSaving) {
        setAutoSaving(true);

        const fd = new FormData();
        fd.set("date", today);
        fd.set("kcal", String(data.total_kcal));
        fd.set("note", buildNote());

        const saveRes = await onSave(fd);

        if (saveRes?.ok) {
          setSaveMsg("✅ Ajouté aux calories d’aujourd’hui");
          router.refresh();
        } else {
          setSaveMsg("❌ Erreur lors de l’enregistrement");
          setAutoSaving(false);
        }
      }
    } catch (e: any) {
      setError(e?.message || "confirm_error");
      setConfirmed(null);
    } finally {
      setConfirming(false);
    }
  }

  function buildNote(): string {
    if (!result) return t("calories.foodSnap.note.photo");
    const suffix = confirmed?.confirmed ? "confirmé" : "estimé";

    if (result.kind === "plate") {
      const parts = items.slice(0, 4).map((it) => `${it.label} ${it.grams}g`);
      return `${t("calories.foodSnap.note.platePrefix")} ${parts.join(" + ")} (${suffix})`;
    }

    const itemLabel = label || t("calories.foodSnap.note.defaultItem");
    const gramsPart = `~${portion}g`;
    const kcalPart = `@${kcal100 || "?"}kcal/100g`;
    return `${t("calories.foodSnap.note.productPrefix")} ${itemLabel} ${gramsPart} ${kcalPart} (${suffix})`;
  }

  function injectToMainForm() {
    const kcal = confirmed?.confirmed ? confirmed.total_kcal : null;
    if (!kcal) return;

    const kcalInput = document.querySelector<HTMLInputElement>('form[action][method="post"] input[name="kcal"]');
    const noteInput = document.querySelector<HTMLInputElement>('form[action][method="post"] input[name="note"]');

    if (kcalInput) kcalInput.value = String(kcal);
    if (noteInput) noteInput.value = buildNote();

    const submit = document.querySelector<HTMLButtonElement>('form[action][method="post"] button[type="submit"]');
    submit?.focus();
  }

  const canFinalize = !!confirmed?.confirmed && !!confirmed.total_kcal;

  const estPlateTotals = result?.kind === "plate" ? estimateTotalsFromItems(items) : null;
  const estProdTotals = result?.kind === "product" ? estimateTotalsFromProduct() : null;

  const shownTotals = confirmed?.confirmed ? confirmed : result?.kind === "plate" ? estPlateTotals : estProdTotals;

  return (
    <div className="card" style={{ border: "1px dashed #d1d5db", padding: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600 }} dangerouslySetInnerHTML={{ __html: t("calories.foodSnap.header.title") }} />
          <div className="text-xs" style={{ color: "#6b7280" }}>
            {t("calories.foodSnap.header.subtitle")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={onPick} style={{ fontSize: 13 }}>
            {t("calories.foodSnap.buttons.photo")}
          </button>
          <button className="btn" type="button" onClick={() => setShowScanner(true)} style={{ fontSize: 13 }}>
            {t("calories.foodSnap.buttons.scan")}
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
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

      {/* Search */}
      <div className="card" style={{ marginTop: 10, padding: 10, border: "1px solid #e5e7eb" }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{t("calories.foodSnap.search.title")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <input
            className="input"
            type="search"
            placeholder={t("calories.foodSnap.search.placeholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn" type="button" onClick={searchAnyFoodByName} disabled={qLoading}>
            {qLoading ? t("calories.foodSnap.search.loading") : t("calories.foodSnap.search.submit")}
          </button>
        </div>

        {qErr && <div className="text-xs" style={{ color: "#dc2626", marginTop: 6 }}>{qErr}</div>}

        {qResults.length > 0 && (
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {qResults.map((c, i) => (
              <div key={i} className="card" style={{ padding: 8, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8 }}>
                <div className="text-sm" style={{ lineHeight: 1.3 }}>
                  <div><strong>{c.label}</strong></div>
                  <div className="text-xs" style={{ color: "#6b7280" }}>
                    {c.kcal_per_100g || "?"} kcal/100g · P {c.proteins_g_per_100g ?? "?"}g · G {c.carbs_g_per_100g ?? "?"}g · L {c.fats_g_per_100g ?? "?"}g
                  </div>
                </div>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    const prod: AnalyzeProductResult = {
                      kind: "product",
                      needs_user_confirmation: true,
                      top: c,
                      candidates: [c],
                      net_weight_g: null,
                      barcode: null,
                      portion_estimated_g: 250,
                      warnings: [],
                    };
                    setResult(prod);
                    setConfirmed(null);

                    applyCandidateToProduct(c);
                    setBarcode(null);
                    setPortion(250);
                    setSaveMsg(null);
                    setAutoSaving(false);
                  }}
                >
                  {t("calories.foodSnap.search.choose")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <img src={preview} alt={t("calories.foodSnap.preview.alt")} style={{ maxWidth: "100%", borderRadius: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-dash" onClick={analyze} disabled={loading}>
              {loading ? t("calories.foodSnap.preview.analyzeLoading") : t("calories.foodSnap.preview.analyze")}
            </button>
            <button className="btn" onClick={resetAll}>
              {t("calories.foodSnap.preview.reset")}
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-xs" style={{ color: "#dc2626", marginTop: 8 }}>{error}</div>}

      {/* Result */}
      {result && (
        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
          <div className="text-xs" style={{ color: "#6b7280" }}>
            Ajuste les quantités puis confirme.
          </div>

          {result.kind === "plate" ? (
            <>
              <div style={{ fontWeight: 600 }}>{t("calories.foodSnap.plate.title")}</div>

              <div style={{ display: "grid", gap: 8 }}>
                {items.map((it, idx) => {
                  const kcal = Math.round((it.grams * it.kcal_per_100g) / 100);
                  const prot = it.proteins_g_per_100g != null ? round1((it.grams * it.proteins_g_per_100g) / 100) : null;
                  const carbs = it.carbs_g_per_100g != null ? round1((it.grams * Number(it.carbs_g_per_100g)) / 100) : null;
                  const fats = it.fats_g_per_100g != null ? round1((it.grams * Number(it.fats_g_per_100g)) / 100) : null;

                  return (
                    <div key={idx} className="card" style={{ padding: 8, display: "grid", gap: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 8, alignItems: "center" }}>
                        <div style={{ fontSize: 14 }}>
                          <strong>{it.label}</strong>
                        </div>
                        <label className="label" style={{ margin: 0 }}>
                          {t("calories.foodSnap.plate.grams")}
                          <input
                            className="input"
                            type="number"
                            min={0}
                            step={1}
                            value={it.grams}
                            onChange={(e) => setItems((b) => b.map((x, i) => (i === idx ? { ...x, grams: Number(e.target.value) } : x)))}
                          />
                        </label>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, alignItems: "end" }}>
                        <label className="label" style={{ margin: 0 }}>
                          kcal/100g
                          <input
                            className="input"
                            type="number"
                            min={0}
                            step={1}
                            value={it.kcal_per_100g}
                            onChange={(e) => setItems((b) => b.map((x, i) => (i === idx ? { ...x, kcal_per_100g: Number(e.target.value) } : x)))}
                          />
                        </label>

                        <label className="label" style={{ margin: 0 }}>
                          P/100g
                          <input
                            className="input"
                            type="number"
                            min={0}
                            step="0.1"
                            value={it.proteins_g_per_100g ?? 0}
                            onChange={(e) => setItems((b) => b.map((x, i) => (i === idx ? { ...x, proteins_g_per_100g: Number(e.target.value) } : x)))}
                          />
                        </label>

                        <label className="label" style={{ margin: 0 }}>
                          G/100g
                          <input
                            className="input"
                            type="number"
                            min={0}
                            step="0.1"
                            value={it.carbs_g_per_100g ?? 0}
                            onChange={(e) => setItems((b) => b.map((x, i) => (i === idx ? { ...x, carbs_g_per_100g: Number(e.target.value) } : x)))}
                          />
                        </label>

                        <label className="label" style={{ margin: 0 }}>
                          L/100g
                          <input
                            className="input"
                            type="number"
                            min={0}
                            step="0.1"
                            value={it.fats_g_per_100g ?? 0}
                            onChange={(e) => setItems((b) => b.map((x, i) => (i === idx ? { ...x, fats_g_per_100g: Number(e.target.value) } : x)))}
                          />
                        </label>
                      </div>

                      <div className="text-xs" style={{ color: "#6b7280", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "tabular-nums" }}>
                          {kcal} kcal · P {prot ?? "—"}g · G {carbs ?? "—"}g · L {fats ?? "—"}g
                        </span>
                        <button className="btn" onClick={() => setItems((b) => b.filter((_, i) => i !== idx))}>
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14 }}>
                <strong>{t("calories.foodSnap.product.title")}</strong>
                {" : "}
                {label}
                {barcode ? <span className="text-xs" style={{ color: "#6b7280" }}> — {barcode}</span> : null}
              </div>

              {result.candidates?.length > 1 && (
                <div className="card" style={{ padding: 10, border: "1px solid #e5e7eb" }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Produits possibles</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {result.candidates.map((c, i) => (
                      <div key={i} className="card" style={{ padding: 8, display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                        <div className="text-sm" style={{ lineHeight: 1.3 }}>
                          <div><strong>{c.label}</strong></div>
                          <div className="text-xs" style={{ color: "#6b7280" }}>
                            {c.kcal_per_100g} kcal/100g · P {c.proteins_g_per_100g ?? "?"}g · G {c.carbs_g_per_100g ?? "?"}g · L {c.fats_g_per_100g ?? "?"}g
                          </div>
                        </div>
                        <button className="btn" type="button" onClick={() => applyCandidateToProduct(c)}>
                          Choisir
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(4, 1fr)", alignItems: "end" }}>
                <label className="label">
                  {t("calories.foodSnap.product.portion")}
                  <input className="input" type="number" min={0} step={1} value={portion} onChange={(e) => setPortion(Number(e.target.value))} />
                </label>
                <label className="label">
                  {t("calories.foodSnap.product.kcalPer100")}
                  <input className="input" type="number" min={0} step={1} value={kcal100} onChange={(e) => setKcal100(e.target.value)} />
                </label>
                <label className="label">
                  {t("calories.foodSnap.product.protPer100")}
                  <input className="input" type="number" min={0} step="0.1" value={prot100} onChange={(e) => setProt100(e.target.value)} />
                </label>
                <label className="label">
                  G/100g
                  <input className="input" type="number" min={0} step="0.1" value={carb100} onChange={(e) => setCarb100(e.target.value)} />
                </label>
              </div>

              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(4, 1fr)", alignItems: "end" }}>
                <label className="label">
                  L/100g
                  <input className="input" type="number" min={0} step="0.1" value={fat100} onChange={(e) => setFat100(e.target.value)} />
                </label>
                <label className="label">
                  Fibres/100g
                  <input className="input" type="number" min={0} step="0.1" value={fiber100} onChange={(e) => setFiber100(e.target.value)} />
                </label>
                <label className="label">
                  Sucres/100g
                  <input className="input" type="number" min={0} step="0.1" value={sugar100} onChange={(e) => setSugar100(e.target.value)} />
                </label>
                <label className="label">
                  Sel/100g
                  <input className="input" type="number" min={0} step="0.01" value={salt100} onChange={(e) => setSalt100(e.target.value)} />
                </label>
              </div>
            </>
          )}

          {/* Totaux */}
          <div className="card" style={{ padding: 10, border: "1px solid #e5e7eb" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              {confirmed?.confirmed ? tf("calories.foodSnap.confirm.finalTotal", "Total confirmé") : tf("calories.foodSnap.confirm.estimatedTotal", "Total estimé")}
            </div>

            <div style={{ fontFamily: "tabular-nums" }}>
              <div>
                {confirmed?.confirmed ? "" : "≈ "}
                {(shownTotals as any)?.total_kcal ?? "—"} kcal
              </div>
              <div className="text-xs" style={{ color: "#6b7280" }}>
                P {(shownTotals as any)?.total_proteins_g ?? "—"}g · G {(shownTotals as any)?.total_carbs_g ?? "—"}g · L {(shownTotals as any)?.total_fats_g ?? "—"}g
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              className="btn btn-dash"
              onClick={confirmAndCompute}
              disabled={autoSaving || confirming || !(shownTotals as any)?.total_kcal}
            >
              {confirming ? tf("calories.foodSnap.confirm.loading", "Calcul…") : tf("calories.foodSnap.confirm.button", "Confirmer & calculer")}
            </button>

            <button className="btn" onClick={injectToMainForm} disabled={!canFinalize}>
              {t("calories.foodSnap.actions.fillForm")}
            </button>

            {/* Bouton manuel (optionnel) : on le garde si tu veux */}
            {onSave && (
              <form
                action={async (fd) => {
                  // garde le comportement (sans redirect) si l’utilisateur veut cliquer manuellement
                  const r = await onSave(fd);
                  if ((r as any)?.ok) {
                    setSaveMsg("✅ Ajouté aux calories d’aujourd’hui");
                    router.refresh();
                  } else {
                    setSaveMsg("❌ Erreur lors de l’enregistrement");
                  }
                }}
                style={{ display: "inline-flex", gap: 8 }}
              >
                <input type="hidden" name="date" value={today} />
                <input type="hidden" name="kcal" value={canFinalize ? (confirmed as any).total_kcal : 0} />
                <input type="hidden" name="note" value={buildNote()} />
                <button className="btn btn-dash" type="submit" disabled={!canFinalize || autoSaving}>
                  {t("calories.foodSnap.actions.addToCalories")}
                </button>
              </form>
            )}
          </div>

          {saveMsg && (
            <div className="text-xs" style={{ color: saveMsg.startsWith("✅") ? "#16a34a" : "#dc2626", marginTop: 6 }}>
              {saveMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
