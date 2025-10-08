"use client";

import { useEffect, useRef, useState } from "react";

/* ===================== Types ===================== */
interface AnalysisPoint { time: number; label: string; detail?: string; }
interface Fault { issue: string; severity: "faible"|"moyenne"|"élevée"; evidence?: string; correction?: string; }
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
    phase?: "setup"|"descente"|"bas"|"montée"|"lockout";
    spine?: { neutral?: boolean; tilt_deg?: number };
    knees?: { valgus_level?: 0|1|2; should_bend?: boolean };
    head?: { chin_tuck?: boolean };
    feet?: { anchor?: "talons"|"milieu"|"avant"; unstable?: boolean };
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
    <div style={{ height: 8, width: "100%", background: "#e5e7eb", borderRadius: 999 }}>
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
    const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % max;
  }
  return Math.floor(Math.random() * max);
}
function pick<T>(arr: T[]): T { return arr[randInt(arr.length)]; }

const LEX = {
  core: ["gainage", "sangle abdominale", "ceinture abdominale"],
  braceVerb: ["gaine", "serre", "verrouille", "contracte"],
  neutralSpine: ["rachis neutre", "dos plat", "alignement lombaire neutre"],
  chestUp: ["poitrine fière", "sternum haut", "buste ouvert"],
  shoulderPack: ["épaules abaissées/serrées", "omoplates basses/rétractées", "pack scapulaire"],
  avoidMomentum: ["évite l’élan", "pas d’à-coups", "contrôle le mouvement"],
  controlCue: ["amplitude contrôlée", "mouvement maîtrisé", "contrôle sur toute l’amplitude"],
  rangeCue: ["amplitude utile", "range complet sans douleur", "aller-retour propre"],
  tempoIntro: ["Tempo", "Cadence", "Rythme"],
  tempo201: ["2–0–1", "2-0-1", "2s-0-1s"],
  tempo311: ["3–1–1", "3-1-1", "3s-1-1s"],
  breathe: ["souffle sur l’effort", "expire à la phase concentrique", "inspire au retour"],
  footTripod: ["appuis trépied (talon + base gros/petit orteil)", "ancre tes pieds"],
  kneeTrack: ["genoux dans l’axe", "genoux suivent la pointe de pieds", "pas de valgus"],
  hipBack: ["hanche en arrière", "charnière franche", "pense fesses loin derrière"],
  gluteCue: ["pousse le talon", "chasse le talon", "guide le talon"],
  holdTop: ["marque 1 s en contraction", "pause 1 s en pic de contraction", "garde 1 s en haut"],
  grip: ["prise ferme", "serre la barre", "poignées verrouillées"],
  elbowPathPush: ["coudes ~45° du buste", "coudes sous la barre", "coudes ni trop ouverts ni collés"],
  elbowPathPull: ["coudes près du buste", "coudes vers la hanche", "coudes sous la ligne d’épaule"],
  latDepress: ["abaisse les épaules", "déprime les scapulas", "descends les omoplates"],
  scapRetract: ["rétracte les omoplates", "serre les omoplates", "omoplates tirées en arrière"],
  wristNeutral: ["poignets neutres", "poignets alignés", "pas cassés"],
  headNeutral: ["regard neutre", "nuque longue", "évite l’hyperextension cervicale"],
};

type Category =
  | "squat" | "lunge" | "hinge" | "hipthrust" | "legpress"
  | "quad_iso" | "ham_iso" | "calf"
  | "pull_vertical" | "pull_horizontal" | "row_chest" | "face_pull"
  | "push_horizontal" | "push_vertical" | "dip" | "pushup" | "fly" | "lateral_raise" | "front_raise" | "rear_delt"
  | "biceps" | "triceps"
  | "core_plank" | "core_anti_rotation" | "core_flexion"
  | "carry" | "sled"
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
  const seen = new Set<string>(); const out: string[] = [];
  for (const s of arr) { const k = s.toLowerCase().trim(); if (!seen.has(k)) { seen.add(k); out.push(s); } }
  for (let i = out.length - 1; i > 0; i--) { const j = randInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
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
      tips.push(`${pick(LEX.kneeTrack)}.`, `${pick(LEX.footTripod)}.`, `${pick(LEX.chestUp)}; ${pick(LEX.controlCue)}.`, `${pick(LEX.tempoIntro)} ${pick(LEX.tempo311)}.`);
      break;
    case "hinge":
      tips.push(`${pick(LEX.hipBack)}; genoux souples.`, `${pick(LEX.neutralSpine)}; ${pick(LEX.scapRetract)}.`, `${pick(LEX.tempoIntro)} ${pick(LEX.tempo311)}.`);
      break;
    case "push_vertical":
      tips.push(`${pick(LEX.elbowPathPush)}.`, `${pick(LEX.core)[0]} solide; fessiers contractés.`, `${pick(LEX.controlCue)}.`);
      break;
    default:
      tips.push(`Contrôle l’amplitude et garde un ${pick(LEX.neutralSpine)}.`, `${pick(LEX.braceVerb)} ta ${pick(LEX.core)}.`, `${pick(LEX.avoidMomentum)}.`);
      break;
  }

  if (["pull_vertical","pull_horizontal","row_chest","face_pull","push_horizontal","push_vertical","dip","pushup","fly","lateral_raise","front_raise","rear_delt","biceps","triceps"].includes(cat)) {
    tips.push(pick(upperStab));
  } else if (["squat","lunge","hinge","hipthrust","legpress","quad_iso","ham_iso","calf"].includes(cat)) {
    tips.push(pick(lowerStab));
  } else {
    tips.push(pick(universal));
  }
  if (randInt(2) === 0) tips.push(`${pick(LEX.tempoIntro)} ${pick(randInt(2) ? LEX.tempo201 : LEX.tempo311)}.`);
  return uniqueShuffle(tips);
}

/* ===================== Page ===================== */
export default function Page() {
  return (
    <div
      className="container"
      style={{
        paddingTop: 24,
        paddingBottom: 32,
        fontSize: "var(--settings-fs, 12px)", // ⟵ même logique que la 1ère page
      }}
    >
      <div className="page-header">
        <div>
          <h1
            className="h1"
            style={{ fontSize: 22 }} // ⟵ titre fixe 22px comme sur l’autre page
          >
            Import / Enregistrement
          </h1>
          <p className="lead">
            Filme ou importe ta vidéo, ajoute ton ressenti puis lance l’analyse IA.
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

  async function uploadWithProxy(f: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", f);
    fd.append("filename", f.name);
    fd.append("contentType", f.type || "application/octet-stream");
    const res = await fetch("/api/videos/proxy-upload", { method: "POST", body: fd });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      let detail = "";
      try { detail = JSON.parse(txt)?.error || txt; } catch { detail = txt; }
      const err = new Error(`proxy-upload: HTTP ${res.status} ${detail}`);
      (err as any).status = res.status;
      throw err;
    }
    const json = await res.json();
    return json.url as string;
  }

  async function uploadWithSignedUrl(f: File): Promise<{ path: string; readUrl: string }> {
    const r = await fetch("/api/videos/sign-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: f.name }),
    });
    if (!r.ok) throw new Error(`sign-upload: HTTP ${r.status} ${await r.text()}`);
    const { signedUrl, path } = await r.json();

    const put = await fetch(signedUrl, {
      method: "PUT",
      headers: {
        "content-type": f.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: f,
    });
    if (!put.ok) throw new Error(`upload PUT failed: ${put.status} ${await put.text()}`);

    const r2 = await fetch("/api/storage/sign-read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, expiresIn: 60 * 60 }),
    });
    if (!r2.ok) throw new Error(`sign-read: HTTP ${r2.status} ${await r2.text()}`);
    const { url } = await r2.json();
    return { path, readUrl: url as string };
  }

  const onAnalyze = async (userExercise?: string) => {
    if (!file || isAnalyzing || cooldown > 0) return;

    setIsAnalyzing(true);
    setProgress(5);
    setStatus("Files examine…"); // ← remplace le texte initial
    setErrorMsg("");

    try {
      // 0) EXTRACTION
      const { frames, timestamps } = await extractFramesFromFile(file, 12);
      if (!frames.length) throw new Error("Impossible d’extraire des images de la vidéo.");
      setProgress(12);

      const half = Math.ceil(frames.length / 2);
      const mosaic1 = await makeMosaic(frames.slice(0, half), 3, 2, 1280, 720, 0.6);
      const mosaic2 = await makeMosaic(frames.slice(half), 3, 2, 1280, 720, 0.6);
      const mosaics = [mosaic1, mosaic2];
      const midTime = timestamps[Math.floor(timestamps.length / 2)] || 0;

      setProgress(20);

      // 1) UPLOAD
      setStatus("Files examine…"); // ← remplace "Upload de la vidéo…"
      let fileUrl: string | undefined;
      if (file.size > CLIENT_PROXY_MAX_BYTES) {
        setStatus("Files examine…"); // ← remplace "Fichier volumineux — upload signé…"
        const { readUrl } = await uploadWithSignedUrl(file);
        fileUrl = readUrl;
      } else {
        try {
          const url = await uploadWithProxy(file);
          fileUrl = url;
        } catch {
          setStatus("Files examine…"); // ← remplace "Proxy indisponible — upload signé…"
          const { readUrl } = await uploadWithSignedUrl(file);
          fileUrl = readUrl;
        }
      }

      if (!fileUrl) throw new Error("Upload échoué (aucune URL retournée)");
      setProgress(75);

      // 2) APPEL IA
      void fakeProgress(setProgress, 80, 98);
      setStatus("Files examine…"); // ← remplace "Analyse IA…"

      const baseHints =
        `Tu reçois des mosaïques issues d’une VIDEO (pas une photo). ` +
        `Identifie l'exercice et détecte les ERREURS TECHNIQUES. Réponds en FRANÇAIS.`;
      const overrideHint = userExercise ? `Exercice exécuté indiqué par l'utilisateur : "${userExercise}".` : "";

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          frames: mosaics,
          timestamps: [midTime],
          feeling,
          economyMode: true,
          promptHints: [baseHints, overrideHint].filter(Boolean).join(" "),
        }),
      });

      if (!res.ok) {
        const retryAfterHdr = res.headers.get("retry-after");
        const retryAfter = parseInt(retryAfterHdr || "", 10);
        const seconds = Number.isFinite(retryAfter)
          ? retryAfter
          : res.status === 504
          ? 12
          : res.status === 429
          ? 20
          : 0;

        if (res.status === 429 || res.status === 504) {
          setCooldown(seconds);
          setStatus(`Réessaie dans ${seconds}s…`);
        }

        const txt = await res.text().catch(() => "");
        throw new Error(`analyze: HTTP ${res.status} ${txt}`);
      }

      const data: Partial<AIAnalysis> = await res.json();

      const safe: AIAnalysis = {
        exercise: String(data.exercise || "exercice_inconnu"),
        overall:
          (data.overall && data.overall.trim()) ||
          "Analyse effectuée mais je manque d’indices visuels. Réessaie avec un angle plus net / cadrage entier.",
        muscles: Array.isArray(data.muscles) && data.muscles.length ? data.muscles.slice(0, 8) : [],
        corrections: Array.isArray((data as any).corrections) ? (data as any).corrections : [],
        faults: Array.isArray((data as any).faults) ? (data as any).faults : [],
        extras: Array.isArray(data.extras) ? data.extras : [],
        timeline:
          Array.isArray(data.timeline)
            ? data.timeline.filter(v => typeof v?.time === "number" && typeof v?.label === "string")
            : [],
        objects: Array.isArray((data as any)?.objects) ? (data as any).objects : [],
        movement_pattern: typeof (data as any)?.movement_pattern === "string" ? (data as any).movement_pattern : undefined,
        skeleton_cues: Array.isArray((data as any)?.skeleton_cues) ? (data as any).skeleton_cues : [],
      };

      // Post-traitement “coach”
      safe.overall = varyTerms(safe.overall);
      safe.faults = (safe.faults || []).map((f) => ({
        ...f,
        issue: varyTerms(f.issue || ""),
        correction: varyTerms(f.correction || ""),
      }));
      safe.corrections = uniqueShuffle([
        ...makeCorrections(safe.exercise || ""),
        ...(safe.corrections || []).map(varyTerms),
      ]).slice(0, 5);
      safe.muscles = (safe.muscles || []).map(varyTerms);

      // Gate de confirmation
      setAnalysis(safe);
      setPredictedExercise(safe.exercise || "exercice_inconnu");
      if (userExercise && userExercise.trim()) {
        setConfirmedExercise(userExercise.trim());
        setShowChoiceGate(false);
      } else {
        setShowChoiceGate(true);
      }
      setProgress(100);
      setStatus("Analyse terminée — confirme l’exercice");
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || String(e));
      setErrorMsg(msg);
      setStatus("");
      alert(`Erreur pendant l'analyse: ${msg}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const confirmPredicted = () => { setConfirmedExercise(predictedExercise || null); setShowChoiceGate(false); };
  const submitOverride = async () => {
    if (!overrideName.trim()) return;
    setConfirmedExercise(overrideName.trim());
    await onAnalyze(overrideName.trim());
    setShowChoiceGate(false);
    setOverrideOpen(false);
  };
  const reset = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null); setFileName(null); setFile(null);
    setAnalysis(null); setFeeling(""); setProgress(0); setStatus("");
    setErrorMsg(""); setCooldown(0);
    setPredictedExercise(null); setShowChoiceGate(false);
    setOverrideOpen(false); setOverrideName("");
    setConfirmedExercise(null);
  };

  const { issuesLine, correctionsLine } = faultsToLines(analysis);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Colonne gauche : Capture */}
        <article className="card">
          <h3 style={{ marginTop: 0 }}>🎥 Import / Enregistrement</h3>

          {/* Onglets Filmer / Importer : actif vert, inactif NOIR SUR BLANC */}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() => setTab("record")}
              type="button"
              className="btn"
              style={{
                background: tab === "record" ? "#16a34a" : "#ffffff",
                color: tab === "record" ? "#ffffff" : "#111827",
                border: "1px solid #d1d5db",
                fontWeight: 500
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
                fontWeight: 500
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
              <label className="label" style={{ marginBottom: 6 }}>Fichier chargé</label>
              <div className="card" style={{ padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="truncate">🎞️ {fileName ?? "clip.webm"}</span>
                <button
                  className="btn"
                  onClick={reset}
                  type="button"
                  style={{
                    background: "#ffffff",
                    color: "#111827",
                    border: "1px solid #d1d5db",
                    fontWeight: 500
                  }}
                >
                  ↺ Réinitialiser
                </button>
              </div>
            </div>
          )}
        </article>

        {/* Colonne droite : Ressenti + action */}
        <article className="card">
          <h3 style={{ marginTop: 0 }}>🎙️ Ton ressenti</h3>
          <label className="label">Comment tu te sens ?</label>
          <textarea
            className="input"
            placeholder="Explique douleurs, fatigue, où tu as senti l'effort, RPE, etc."
            value={feeling}
            onChange={(e) => setFeeling(e.target.value)}
            style={{ minHeight: 140 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              className="btn btn-dash"
              disabled={!blobUrl || isAnalyzing || cooldown > 0}
              onClick={() => onAnalyze()}
              type="button"
            >
              {isAnalyzing ? <Spinner className="mr-2" /> : "✨"}{" "}
              {isAnalyzing ? "Analyse en cours" : cooldown > 0 ? `Patiente ${cooldown}s` : "Lancer l'analyse IA"}
            </button>

            {/* Reset du textarea : NOIR SUR BLANC */}
            <button
              className="btn"
              type="button"
              onClick={() => setFeeling("")}
              style={{
                background: "#ffffff",
                color: "#111827",
                border: "1px solid #d1d5db",
                fontWeight: 500
              }}
              disabled={isAnalyzing}
            >
              Réinitialiser
            </button>
          </div>

          {(isAnalyzing || progress > 0 || errorMsg || status) && (
            <div style={{ marginTop: 12 }}>
              <ProgressBar value={progress} />
              {status && <p className="text-xs" style={{ color: "#6b7280", marginTop: 6 }}>{status}</p>}
              {errorMsg && <p className="text-xs" style={{ color: "#dc2626", marginTop: 6 }}>Erreur : {errorMsg}</p>}
            </div>
          )}
        </article>
      </div>

      {/* Résumé IA */}
      <article className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>🧠 Résumé IA</h3>

        {!analysis && (
          <p className="text-sm" style={{ color: "#6b7280" }}>
            Importe une vidéo puis lance l’analyse pour obtenir le résumé ici.
          </p>
        )}

        {/* GATE de confirmation : "Confirmer" vert, "Autre" NOIR/BLANC */}
        {analysis && showChoiceGate && (
          <div style={{ display: "grid", gap: 8 }}>
            <div className="text-sm">
              L’IA propose : <strong>{predictedExercise || "exercice_inconnu"}</strong>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-dash" onClick={confirmPredicted} disabled={isAnalyzing} type="button">
                Confirmer « {predictedExercise || "exercice_inconnu"} »
              </button>
              <button
                className="btn"
                onClick={() => setOverrideOpen(true)}
                disabled={isAnalyzing}
                type="button"
                style={{ background: "#ffffff", color: "#111827", border: "1px solid #d1d5db", fontWeight: 500 }}
              >
                Autre
              </button>
            </div>

            {overrideOpen && (
              <div className="card" style={{ padding: 12 }}>
                <label className="label">Quel exercice fais-tu ?</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    className="input"
                    placeholder="ex. Tractions, Fentes bulgares, Soulevé de terre…"
                    value={overrideName}
                    onChange={(e) => setOverrideName(e.target.value)}
                  />
                  <button
                    className="btn"
                    onClick={submitOverride}
                    disabled={isAnalyzing || !overrideName.trim()}
                    type="button"
                    style={{ background: "#ffffff", color: "#111827", border: "1px solid #d1d5db", fontWeight: 500 }}
                  >
                    Ré-analyser
                  </button>
                </div>
                <p className="text-xs" style={{ color: "#6b7280", marginTop: 6 }}>
                  L’IA tiendra compte de ce nom pour corriger plus précisément.
                </p>
              </div>
            )}
          </div>
        )}

        {/* RÉSULTATS */}
        {analysis && !showChoiceGate && (
          <div style={{ display: "grid", gap: 12 }}>
            <div className="text-sm">
              <span style={{ color: "#6b7280" }}>Exercice :</span>{" "}
              <strong>{confirmedExercise || analysis.exercise || "inconnu"}</strong>
            </div>

            {analysis.overall?.trim() && (
              <p className="text-sm" style={{ lineHeight: 1.6 }}>{analysis.overall.trim()}</p>
            )}

            <div>
              <h4 className="h4" style={{ fontSize: 14, margin: "8px 0 4px" }}>Muscles principalement sollicités</h4>
              {analysis.muscles?.length ? (
                <p className="text-sm">{analysis.muscles.join(" - ")}</p>
              ) : (
                <p className="text-xs" style={{ color: "#6b7280" }}>— non détecté —</p>
              )}
            </div>

            {(issuesLine || correctionsLine) && (
              <div style={{ display: "grid", gap: 4 }}>
                {issuesLine && <p className="text-sm"><strong>Erreur détectée :</strong> {issuesLine}</p>}
                {correctionsLine && <p className="text-sm"><strong>Corrections :</strong> {correctionsLine}</p>}
              </div>
            )}

            {analysis.extras && analysis.extras.length > 0 && (
              <details>
                <summary style={{ cursor: "pointer" }}>Points complémentaires</summary>
                <ul style={{ paddingLeft: 18, marginTop: 6 }} className="text-sm">
                  {analysis.extras.map((x, i) => <li key={i} style={{ listStyle: "disc" }}>{x}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </article>
    </>
  );
}

/* ===================== Upload/Record ===================== */
function UploadDrop({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };
  return (
    <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="border-2 border-dashed rounded-2xl p-6 text-center">
      <div className="mx-auto h-8 w-8 mb-2">☁️</div>
      <p className="text-sm mb-2">Glisse une vidéo ici ou</p>
      <div className="flex items-center justify-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
        <button
          type="button"
          className="btn"
          onClick={() => inputRef.current?.click()}
          style={{ background: "#ffffff", color: "#111827", border: "1px solid #d1d5db", fontWeight: 500 }}
        >
          Choisir un fichier
        </button>
      </div>
    </div>
  );
}

function VideoRecorder({ onRecorded }: { onRecorded: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [hasStream, setHasStream] = useState(false);

  useEffect(() => {
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await (videoRef.current as HTMLVideoElement).play();
        setHasStream(true);
      }
      const mr = new MediaRecorder(stream, { mimeType: getBestMimeType(), videoBitsPerSecond: 350_000 });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        const file = new File([blob], `enregistrement-${Date.now()}.webm`, { type: blob.type });
        onRecorded(file);
      };
      mr.start();
      setIsRecording(true);
    } catch (err) {
      alert("Impossible d'accéder à la caméra/micro. Vérifie les permissions.");
      console.error(err);
    }
  };

  const stop = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    setIsRecording(false);
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    setHasStream(false);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <video ref={videoRef} className="w-full rounded-2xl border" muted playsInline />
        {!hasStream && (<div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">Prépare ta caméra puis clique « Démarrer »</div>)}
      </div>
      <div className="flex items-center gap-2">
        {!isRecording ? (
          <button className="btn btn-dash" onClick={start} type="button">▶️ Démarrer</button>
        ) : (
          <button className="btn" onClick={stop} type="button" style={{ background: "#ffffff", color: "#111827", border: "1px solid #d1d5db", fontWeight: 500 }}>⏸️ Arrêter</button>
        )}
      </div>
    </div>
  );
}

/* ===== Helpers vidéo / images ===== */

function getBestMimeType() {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  for (const c of candidates) {
    // @ts-ignore
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "video/webm";
}
async function fakeProgress(setter: (v: number) => void, from: number, to: number) {
  let i = from;
  while (i < to) {
    await new Promise((r) => setTimeout(r, 220));
    i += Math.floor(Math.random() * 10) + 3;
    setter(Math.min(i, to));
  }
}
/** ➜ Extrait N frames JPEG (dataURL) d’un fichier vidéo local. */
async function extractFramesFromFile(file: File, nFrames = 12): Promise<{ frames: string[]; timestamps: number[] }> {
  const videoURL = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = videoURL;
    (video as any).muted = true;
    (video as any).playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Impossible de lire la vidéo côté client."));
    });

    const duration = Math.max(0.001, (video as any).duration || 0);
    const times: number[] = [];
    for (let i = 0; i < nFrames; i++) {
      const t = (duration * (i + 1)) / (nFrames + 1);
      times.push(t);
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const frames: string[] = [];
    const timestamps: number[] = [];
    const targetW = 640, targetH = 360;

    for (const t of times) {
      await seek(video as any, t);
      const vw = (video as any).videoWidth || targetW;
      const vh = (video as any).videoHeight || targetH;
      const { width, height } = bestFit(vw, vh, targetW, targetH);
      canvas.width = width; canvas.height = height;
      ctx.drawImage(video as any, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
      frames.push(dataUrl);
      timestamps.push(Math.round(t));
    }
    return { frames, timestamps };
  } finally {
    URL.revokeObjectURL(videoURL);
  }
}
function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("Échec du seek vidéo.")); };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    try { (video as any).currentTime = Math.min(Math.max(0, time), (video as any).duration || time); } catch {}
  });
}
function bestFit(w: number, h: number, maxW: number, maxH: number) {
  if (!w || !h) return { width: maxW, height: maxH };
  const r = Math.min(maxW / w, maxH / h);
  return { width: Math.round(w * r), height: Math.round(h * r) };
}
async function makeMosaic(images: string[], gridW = 3, gridH = 2, outW = 1280, outH = 720, quality = 0.6): Promise<string> {
  const cvs = document.createElement("canvas");
  const ctx = cvs.getContext("2d")!;
  cvs.width = outW; cvs.height = outH;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, outW, outH);
  const cellW = Math.floor(outW / gridW);
  const cellH = Math.floor(outH / gridH);
  for (let i = 0; i < Math.min(images.length, gridW * gridH); i++) {
    const img = await loadImage(images[i]);
    const x = (i % gridW) * cellW;
    const y = Math.floor(i / gridW) * cellH;
    const { width, height } = bestFit(img.width, img.height, cellW, cellH);
    const dx = x + Math.floor((cellW - width) / 2);
    const dy = y + Math.floor((cellH - height) / 2);
    ctx.drawImage(img as any, dx, dy, width, height);
  }
  return cvs.toDataURL("image/jpeg", quality);
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img as HTMLImageElement);
    img.onerror = () => reject(new Error("Impossible de charger l’image."));
    img.src = src;
  });
}

/* ---------- Agg util ---------- */
function faultsToLines(a: AIAnalysis | null) {
  if (!a) return { issuesLine: "", correctionsLine: "" };
  const issues = (a?.faults || []).map(f => (f?.issue || "").trim()).filter(Boolean);
  const faultCorrections = (a?.faults || []).map(f => (f?.correction || "").trim()).filter(Boolean);
  const issuesLine = issues.join(" - ");
  const correctionsBase = faultCorrections.length ? faultCorrections : (a?.corrections || []);
  const correctionsLine = (correctionsBase || []).join(" - ");
  return { issuesLine, correctionsLine };
}
