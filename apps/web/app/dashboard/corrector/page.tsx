"use client";

import { useEffect, useRef, useState } from "react";

/* ===================== Types ===================== */
interface AnalysisPoint {
  time: number;
  label: string;
  detail?: string;
}

interface Fault {
  issue: string;
  severity: "faible" | "moyenne" | "élevée";
  evidence?: string;
  correction?: string;
}

interface AIAnalysis {
  exercise: string;
  overall: string;
  muscles: string[];
  corrections: string[];
  faults?: Fault[];
  extras?: string[];
  timeline: AnalysisPoint[];
  objects?: string[];
  movement_pattern?: string;
  rawText?: string;
  skeleton_cues?: Array<{
    phase?: "setup" | "descente" | "bas" | "montée" | "lockout";
    spine?: { neutral?: boolean; tilt_deg?: number };
    knees?: { valgus_level?: 0 | 1 | 2; should_bend?: boolean };
    head?: { chin_tuck?: boolean };
    feet?: { anchor?: "talons" | "milieu" | "avant"; unstable?: boolean };
    notes?: string;
  }>;
}

/* ===================== Constantes ===================== */
const CLIENT_PROXY_MAX_BYTES =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_PROXY_UPLOAD_MAX_BYTES
    ? Number(process.env.NEXT_PUBLIC_PROXY_UPLOAD_MAX_BYTES)
    : 5 * 1024 * 1024; // 5MB

/* ===================== Petites UI ===================== */
function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block align-[-0.125em] h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-label="loading"
    />
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      style={{
        height: 8,
        width: "100%",
        background: "#e5e7eb",
        borderRadius: 999,
      }}
    >
      <div
        style={{
          height: 8,
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: "linear-gradient(90deg,#22c55e,#16a34a)",
          borderRadius: 999,
          transition: "width .25s ease",
        }}
      />
    </div>
  );
}

/* ===================== Vocabulaire & Variations ===================== */
function randInt(max: number) {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function pick<T>(arr: T[]): T {
  return arr[randInt(arr.length)];
}

const LEX = {
  core: ["gainage", "sangle abdominale", "ceinture abdominale"],
  braceVerb: ["gaine", "serre", "verrouille", "contracte"],
  neutralSpine: ["rachis neutre", "dos plat", "alignement lombaire neutre"],
  chestUp: ["poitrine fière", "sternum haut", "buste ouvert"],
  shoulderPack: [
    "épaules abaissées/serrées",
    "omoplates basses/rétractées",
    "pack scapulaire",
  ],
  avoidMomentum: ["évite l’élan", "pas d’à-coups", "contrôle le mouvement"],
  controlCue: [
    "amplitude contrôlée",
    "mouvement maîtrisé",
    "contrôle sur toute l’amplitude",
  ],
  rangeCue: [
    "amplitude utile",
    "range complet sans douleur",
    "aller-retour propre",
  ],
  tempoIntro: ["Tempo", "Cadence", "Rythme"],
  tempo201: ["2–0–1", "2-0-1", "2s-0-1s"],
  tempo311: ["3–1–1", "3-1-1", "3s-1-1s"],
  breathe: [
    "souffle sur l’effort",
    "expire à la phase concentrique",
    "inspire au retour",
  ],
  footTripod: [
    "appuis trépied (talon + base gros/petit orteil)",
    "ancre tes pieds",
  ],
  kneeTrack: [
    "genoux dans l’axe",
    "genoux suivent la pointe de pieds",
    "pas de valgus",
  ],
  hipBack: [
    "hanche en arrière",
    "charnière franche",
    "pense fesses loin derrière",
  ],
  gluteCue: ["pousse le talon", "chasse le talon", "guide le talon"],
  holdTop: [
    "marque 1 s en contraction",
    "pause 1 s en pic de contraction",
    "garde 1 s en haut",
  ],
  grip: ["prise ferme", "serre la barre", "poignées verrouillées"],
  elbowPathPush: [
    "coudes ~45° du buste",
    "coudes sous la barre",
    "coudes ni trop ouverts ni collés",
  ],
  elbowPathPull: [
    "coudes près du buste",
    "coudes vers la hanche",
    "coudes sous la ligne d’épaule",
  ],
  latDepress: [
    "abaisse les épaules",
    "déprime les scapulas",
    "descends les omoplates",
  ],
  scapRetract: [
    "rétracte les omoplates",
    "serre les omoplates",
    "omoplates tirées en arrière",
  ],
  wristNeutral: ["poignets neutres", "poignets alignés", "pas cassés"],
  headNeutral: [
    "regard neutre",
    "nuque longue",
    "évite l’hyperextension cervicale",
  ],
};
type Category =
  | "squat"
  | "lunge"
  | "hinge"
  | "hipthrust"
  | "legpress"
  | "quad_iso"
  | "ham_iso"
  | "calf"
  | "pull_vertical"
  | "pull_horizontal"
  | "row_chest"
  | "face_pull"
  | "push_horizontal"
  | "push_vertical"
  | "dip"
  | "pushup"
  | "fly"
  | "lateral_raise"
  | "front_raise"
  | "rear_delt"
  | "biceps"
  | "triceps"
  | "core_plank"
  | "core_anti_rotation"
  | "core_flexion"
  | "carry"
  | "sled"
  | "unknown";

const EXO_ALIASES: Array<{ rx: RegExp; cat: Category }> = [
  { rx: /(squat|front\s*squat|goblet|hack\s*squat|sissy)/i, cat: "squat" },
  { rx: /(lunge|fente|split\s*squat|walking\s*lunge|bulgarian)/i, cat: "lunge" },
  { rx: /(leg\s*press|presse\s*à\s*jambes)/i, cat: "legpress" },
  { rx: /(leg\s*extension|extension\s*quadriceps)/i, cat: "quad_iso" },
  { rx: /(deadlift|soulev|hinge|rdl|romanian|good\s*morning|hip\s*hinge)/i, cat: "hinge" },
  { rx: /(hip\s*thrust|pont\s*de\s*hanches|glute\s*bridge)/i, cat: "hipthrust" },
  { rx: /(leg\s*curl|ischio|hamstring\s*curl)/i, cat: "ham_iso" },
  { rx: /(calf|mollet|élévation\s*mollets|standing\s*calf|seated\s*calf)/i, cat: "calf" },
  { rx: /(pull[-\s]?up|traction)/i, cat: "pull_vertical" },
  { rx: /(lat\s*pulldown|tirage\s*vertical)/i, cat: "pull_vertical" },
  { rx: /(row|tirage\s*horizontal|barbell\s*row|pendlay|cable\s*row|seated\s*row)/i, cat: "pull_horizontal" },
  { rx: /(chest\s*supported\s*row|row\s*appui\s*pector)/i, cat: "row_chest" },
  { rx: /(face\s*pull)/i, cat: "face_pull" },
  { rx: /(bench|développé\s*couché|décliné|incliné)/i, cat: "push_horizontal" },
  { rx: /(ohp|overhead|militaire|shoulder\s*press|arnold)/i, cat: "push_vertical" },
  { rx: /(push[-\s]?up|pompe)/i, cat: "pushup" },
  { rx: /(dip|dips)/i, cat: "dip" },
  { rx: /(fly|écarté|pec\s*deck)/i, cat: "fly" },
  { rx: /(lateral\s*raise|élévation\s*latérale)/i, cat: "lateral_raise" },
  { rx: /(front\s*raise|élévation\s*frontale)/i, cat: "front_raise" },
  { rx: /(rear\s*delt|oiseau|reverse\s*fly)/i, cat: "rear_delt" },
  { rx: /(curl|biceps)/i, cat: "biceps" },
  { rx: /(triceps|pushdown|extension\s*triceps|kickback|overhead\s*extension)/i, cat: "triceps" },
  { rx: /(plank|planche|side\s*plank|gainage\s*latéral|hollow)/i, cat: "core_plank" },
  { rx: /(pallof|anti[-\s]?rotation|carry\s*offset)/i, cat: "core_anti_rotation" },
  { rx: /(crunch|sit[-\s]?up|leg\s*raise|mountain\s*climber|russian\s*twist)/i, cat: "core_flexion" },
  { rx: /(farmer|carry)/i, cat: "carry" },
  { rx: /(sled|prowler|traîneau)/i, cat: "sled" },
];

function getCategory(exo: string): Category {
  const s = (exo || "").toLowerCase();
  for (const { rx, cat } of EXO_ALIASES) if (rx.test(s)) return cat;
  return "unknown";
}

function varyTerms(s: string) {
  if (!s) return s;
  let out = s;
  out = out.replace(/\bcore\b/gi, pick(LEX.core));
  out = out.replace(/\bdos (plat|droit)\b/gi, pick(LEX.neutralSpine));
  return out;
}

function uniqueShuffle(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = s.toLowerCase().trim();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function makeCorrections(exo: string) {
  const cat = getCategory(exo);
  const tips: string[] = [];
  const universal = [
    `Garde un ${pick(LEX.neutralSpine)} avec ${pick(LEX.chestUp)}.`,
    `${pick(LEX.breathe)}.`,
    `${pick(LEX.wristNeutral)} et ${pick(LEX.headNeutral)}.`,
  ];
  const upperStab = [`${pick(LEX.shoulderPack)}.`, `${pick(LEX.grip)}.`];
  const lowerStab = [`${pick(LEX.footTripod)}.`, `${pick(LEX.kneeTrack)}.`];

  switch (cat) {
    case "squat":
      tips.push(
        `${pick(LEX.kneeTrack)}.`,
        `${pick(LEX.footTripod)}.`,
        `${pick(LEX.chestUp)}; ${pick(LEX.controlCue)}.`,
        `${pick(LEX.tempoIntro)} ${pick(LEX.tempo311)}.`
      );
      break;
    case "hinge":
      tips.push(
        `${pick(LEX.hipBack)}; genoux souples.`,
        `${pick(LEX.neutralSpine)}; ${pick(LEX.scapRetract)}.`,
        `${pick(LEX.tempoIntro)} ${pick(LEX.tempo311)}.`
      );
      break;
    case "push_vertical":
      tips.push(
        `${pick(LEX.elbowPathPush)}.`,
        `${pick(LEX.core)[0]} solide; fessiers contractés.`,
        `${pick(LEX.controlCue)}.`
      );
      break;
    default:
      tips.push(
        `Contrôle l’amplitude et garde un ${pick(LEX.neutralSpine)}.`,
        `${pick(LEX.braceVerb)} ta ${pick(LEX.core)}.`,
        `${pick(LEX.avoidMomentum)}.`
      );
      break;
  }

  if (
    [
      "pull_vertical",
      "pull_horizontal",
      "row_chest",
      "face_pull",
      "push_horizontal",
      "push_vertical",
      "dip",
      "pushup",
      "fly",
      "lateral_raise",
      "front_raise",
      "rear_delt",
      "biceps",
      "triceps",
    ].includes(cat)
  ) {
    tips.push(pick(upperStab));
  } else if (
    [
      "squat",
      "lunge",
      "hinge",
      "hipthrust",
      "legpress",
      "quad_iso",
      "ham_iso",
      "calf",
    ].includes(cat)
  ) {
    tips.push(pick(lowerStab));
  } else {
    tips.push(pick(universal));
  }

  if (randInt(2) === 0)
    tips.push(
      `${pick(LEX.tempoIntro)} ${
        randInt(2) ? pick(LEX.tempo201) : pick(LEX.tempo311)
      }.`
    );
  return uniqueShuffle(tips);
}

/* ===================== Page ===================== */
export default function Page() {
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="page-header" style={{ marginBottom: 8 }}>
        <div>
          <h1 className="h1" style={{ fontSize: 22, color: "#111827" }}>
            Import / Enregistrement
          </h1>
          <p className="lead" style={{ fontSize: 13, marginTop: 4 }}>
            Filme ou importe ta vidéo, ajoute ton ressenti puis lance l’analyse
            IA.
          </p>
        </div>
      </div>

      <CoachAnalyzer />
    </div>
  );
}
/* ===================== Composant principal ===================== */
function CoachAnalyzer() {
  const [tab, setTab] = useState<"record" | "upload">("record");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [feeling, setFeeling] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [predictedExercise, setPredictedExercise] = useState<string | null>(null);
  const [showChoiceGate, setShowChoiceGate] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideName, setOverrideName] = useState("");
  const [confirmedExercise, setConfirmedExercise] = useState<string | null>(null);

  const [cooldown, setCooldown] = useState<number>(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleUpload = (f: File) => {
    const url = URL.createObjectURL(f);
    setBlobUrl(url);
    setFileName(f.name);
    setFile(f);
    setAnalysis(null);
    setErrorMsg("");
    setStatus("");
    setProgress(0);
    setPredictedExercise(null);
    setShowChoiceGate(false);
    setOverrideOpen(false);
    setOverrideName("");
    setConfirmedExercise(null);
  };

  const confirmPredicted = () => {
    setConfirmedExercise(predictedExercise || null);
    setShowChoiceGate(false);
  };

  const submitOverride = async () => {
    if (!overrideName.trim()) return;
    setConfirmedExercise(overrideName.trim());
    await onAnalyze(overrideName.trim());
    setShowChoiceGate(false);
    setOverrideOpen(false);
  };

  const reset = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setFileName(null);
    setFile(null);
    setAnalysis(null);
    setFeeling("");
    setProgress(0);
    setStatus("");
    setErrorMsg("");
    setCooldown(0);
    setPredictedExercise(null);
    setShowChoiceGate(false);
    setOverrideOpen(false);
    setOverrideName("");
    setConfirmedExercise(null);
  };

  const { issuesLine, correctionsLine } = faultsToLines(analysis);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* === Colonne gauche : Import / Enregistrement === */}
        <article className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0, fontSize: 18 }}>🎥 Import / Enregistrement</h3>

          {/* Onglets */}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() => setTab("record")}
              type="button"
              className="btn"
              style={{
                background: tab === "record" ? "#16a34a" : "#ffffff",
                color: tab === "record" ? "#ffffff" : "#111827",
                border: "1px solid #d1d5db",
                fontWeight: 500,
                fontSize: 13,
                padding: "6px 12px",
              }}
            >
              Filmer
            </button>

            <button
              onClick={() => setTab("upload")}
              type="button"
              className="btn"
              style={{
                background: tab === "upload" ? "#16a34a" : "#ffffff",
                color: tab === "upload" ? "#ffffff" : "#111827",
                border: "1px solid #d1d5db",
                fontWeight: 500,
                fontSize: 13,
                padding: "6px 12px",
              }}
            >
              Importer
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            {tab === "record" ? (
              <VideoRecorder onRecorded={handleUpload} />
            ) : (
              <UploadDrop onFile={handleUpload} />
            )}
          </div>

          {blobUrl && (
            <div className="text-sm" style={{ marginTop: 12 }}>
              <label className="label" style={{ fontSize: 13, marginBottom: 6 }}>
                Fichier chargé
              </label>
              <div
                className="card"
                style={{
                  padding: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <span className="truncate">🎞️ {fileName ?? "clip.webm"}</span>
                <button
                  className="btn"
                  onClick={reset}
                  type="button"
                  style={{
                    background: "#ffffff",
                    color: "#111827",
                    border: "1px solid #d1d5db",
                    fontWeight: 500,
                    fontSize: 13,
                    padding: "6px 12px",
                  }}
                >
                  ↺ Réinitialiser
                </button>
              </div>
            </div>
          )}
        </article>

        {/* === Colonne droite : Ressenti + Analyse === */}
        <article className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0, fontSize: 18 }}>🎙️ Ton ressenti</h3>

          <label className="label" style={{ fontSize: 13 }}>
            Comment tu te sens ?
          </label>
          <textarea
            className="input"
            placeholder="Explique douleurs, fatigue, où tu as senti l'effort, RPE, etc."
            value={feeling}
            onChange={(e) => setFeeling(e.target.value)}
            style={{ minHeight: 140, fontSize: 13 }}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              className="btn btn-dash"
              disabled={!blobUrl || isAnalyzing || cooldown > 0}
              onClick={() => onAnalyze()}
              type="button"
              style={{
                fontSize: 13,
                padding: "8px 14px",
              }}
            >
              {isAnalyzing ? <Spinner className="mr-2" /> : "✨"}{" "}
              {isAnalyzing
                ? "Analyse en cours"
                : cooldown > 0
                ? `Patiente ${cooldown}s`
                : "Lancer l'analyse IA"}
            </button>

            <button
              className="btn"
              type="button"
              onClick={() => setFeeling("")}
              style={{
                background: "#ffffff",
                color: "#111827",
                border: "1px solid #d1d5db",
                fontWeight: 500,
                fontSize: 13,
                padding: "8px 14px",
              }}
              disabled={isAnalyzing}
            >
              Réinitialiser
            </button>
          </div>

          {(isAnalyzing || progress > 0 || errorMsg || status) && (
            <div style={{ marginTop: 12 }}>
              <ProgressBar value={progress} />
              {status && (
                <p
                  className="text-xs"
                  style={{ color: "#6b7280", marginTop: 6, fontSize: 12 }}
                >
                  {status}
                </p>
              )}
              {errorMsg && (
                <p
                  className="text-xs"
                  style={{ color: "#dc2626", marginTop: 6, fontSize: 12 }}
                >
                  Erreur : {errorMsg}
                </p>
              )}
            </div>
          )}
        </article>
      </div>
      {/* === Résumé IA === */}
      <article className="card" style={{ marginTop: 16, padding: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 18 }}>🧠 Résumé IA</h3>

        {!analysis && (
          <p className="text-sm" style={{ color: "#6b7280", fontSize: 13 }}>
            Importe une vidéo puis lance l’analyse pour obtenir le résumé ici.
          </p>
        )}

        {/* GATE : confirmation exercice */}
        {analysis && showChoiceGate && (
          <div style={{ display: "grid", gap: 8 }}>
            <div className="text-sm" style={{ fontSize: 13 }}>
              L’IA propose :{" "}
              <strong>{predictedExercise || "exercice_inconnu"}</strong>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn btn-dash"
                onClick={confirmPredicted}
                disabled={isAnalyzing}
                type="button"
                style={{ fontSize: 13, padding: "8px 14px" }}
              >
                Confirmer « {predictedExercise || "exercice_inconnu"} »
              </button>

              <button
                className="btn"
                onClick={() => setOverrideOpen(true)}
                disabled={isAnalyzing}
                type="button"
                style={{
                  background: "#ffffff",
                  color: "#111827",
                  border: "1px solid #d1d5db",
                  fontWeight: 500,
                  fontSize: 13,
                  padding: "8px 14px",
                }}
              >
                Autre
              </button>
            </div>

            {overrideOpen && (
              <div className="card" style={{ padding: 12 }}>
                <label className="label" style={{ fontSize: 13 }}>
                  Quel exercice fais-tu ?
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    className="input"
                    placeholder="ex. Tractions, Fentes bulgares…"
                    value={overrideName}
                    onChange={(e) => setOverrideName(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                  <button
                    className="btn"
                    onClick={submitOverride}
                    disabled={isAnalyzing || !overrideName.trim()}
                    type="button"
                    style={{
                      background: "#ffffff",
                      color: "#111827",
                      border: "1px solid #d1d5db",
                      fontWeight: 500,
                      fontSize: 13,
                      padding: "8px 14px",
                    }}
                  >
                    Ré-analyser
                  </button>
                </div>
                <p
                  className="text-xs"
                  style={{ color: "#6b7280", marginTop: 6, fontSize: 12 }}
                >
                  L’IA tiendra compte de ce nom pour corriger plus précisément.
                </p>
              </div>
            )}
          </div>
        )}

        {/* === Résultats === */}
        {analysis && !showChoiceGate && (
          <div style={{ display: "grid", gap: 12 }}>
            <div className="text-sm" style={{ fontSize: 13 }}>
              <span style={{ color: "#6b7280" }}>Exercice :</span>{" "}
              <strong>{confirmedExercise || analysis.exercise || "inconnu"}</strong>
            </div>

            {analysis.overall?.trim() && (
              <p className="text-sm" style={{ lineHeight: 1.6, fontSize: 13 }}>
                {analysis.overall.trim()}
              </p>
            )}

            <div>
              <h4
                className="h4"
                style={{ fontSize: 14, margin: "8px 0 4px", fontWeight: 700 }}
              >
                Muscles principalement sollicités
              </h4>
              {analysis.muscles?.length ? (
                <p className="text-sm" style={{ fontSize: 13 }}>
                  {analysis.muscles.join(" - ")}
                </p>
              ) : (
                <p
                  className="text-xs"
                  style={{ color: "#6b7280", fontSize: 12 }}
                >
                  — non détecté —
                </p>
              )}
            </div>

            {(issuesLine || correctionsLine) && (
              <div style={{ display: "grid", gap: 4 }}>
                {issuesLine && (
                  <p className="text-sm" style={{ fontSize: 13 }}>
                    <strong>Erreur détectée :</strong> {issuesLine}
                  </p>
                )}
                {correctionsLine && (
                  <p className="text-sm" style={{ fontSize: 13 }}>
                    <strong>Corrections :</strong> {correctionsLine}
                  </p>
                )}
              </div>
            )}

            {analysis.extras && analysis.extras.length > 0 && (
              <details>
                <summary style={{ cursor: "pointer", fontSize: 13 }}>
                  Points complémentaires
                </summary>
                <ul
                  style={{ paddingLeft: 18, marginTop: 6, fontSize: 13 }}
                  className="text-sm"
                >
                  {analysis.extras.map((x, i) => (
                    <li key={i} style={{ listStyle: "disc" }}>
                      {x}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </article>
    </>
  );
}
