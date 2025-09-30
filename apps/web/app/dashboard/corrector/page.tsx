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

/* ===================== Page ===================== */
export default function Page() {
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="page-header">
        <div>
          <h1 className="h1" style={{ fontSize: 22, color: "#111827" }}>Correcteur IA</h1>
          <p className="lead" style={{ fontSize: 13, marginTop: 4 }}>
            Importe une vidéo, ajoute ton ressenti puis laisse l’IA analyser et corriger ta technique.
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

  /* ===== Upload handler ===== */
  const handleUpload = (f: File) => {
    const url = URL.createObjectURL(f);
    setBlobUrl(url);
    setFileName(f.name);
    setFile(f);
    setAnalysis(null);
    setErrorMsg("");
    setStatus("");
    setProgress(0);
  };

  /* ===== Reset ===== */
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
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Colonne gauche */}
        <article className="card">
          <h3 style={{ fontSize: 16, marginTop: 0, color: "#111827" }}>🎥 Import / Enregistrement</h3>

          {/* Tabs */}
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
            <div className="text-sm" style={{ marginTop: 12, fontSize: 13 }}>
              <label className="label" style={{ marginBottom: 6, fontSize: 13 }}>Fichier chargé</label>
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
                    fontWeight: 500,
                    fontSize: 13,
                  }}
                >
                  ↺ Réinitialiser
                </button>
              </div>
            </div>
          )}
        </article>
        {/* Colonne droite */}
        <article className="card">
          <h3 style={{ fontSize: 16, marginTop: 0, color: "#111827" }}>🎙️ Ton ressenti</h3>
          <label className="label" style={{ fontSize: 13 }}>Comment tu te sens ?</label>
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
              disabled={!blobUrl || isAnalyzing}
              type="button"
              style={{ fontSize: 13 }}
              onClick={() => {
                // Démo d'état "analyse" pour l'UI (si tu as déjà ton API, remplace par ton handler)
                setIsAnalyzing(true);
                setStatus("Analyse IA en cours…");
                setProgress(30);
                setTimeout(() => setProgress(65), 800);
                setTimeout(() => setProgress(90), 1600);
                setTimeout(() => {
                  setIsAnalyzing(false);
                  setProgress(100);
                  setStatus("");
                  // Démo de résultat minimal
                  setAnalysis({
                    exercise: "squat",
                    overall:
                      "Garde un dos plat et contrôle l’amplitude. Expire en remontant, genoux dans l’axe.",
                    muscles: ["Quadriceps", "Fessiers", "Ischios"],
                    corrections: [
                      "Pousse les genoux dans l’axe des pieds",
                      "Contrôle la descente (3-1-1)",
                      "Respire : inspire en bas, souffle en haut",
                    ],
                    faults: [
                      { issue: "Valgus léger genou droit", severity: "moyenne", correction: "Pousse le genou vers l’extérieur" },
                    ],
                    extras: ["Stabilité accrue avec poids réparti talon/avant-pied"],
                    timeline: [],
                  });
                }, 2400);
              }}
            >
              {isAnalyzing ? <Spinner className="mr-2" /> : "✨"}{" "}
              {isAnalyzing ? "Analyse en cours" : "Lancer l'analyse IA"}
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
              }}
              disabled={isAnalyzing}
            >
              Réinitialiser
            </button>
          </div>

          {(isAnalyzing || progress > 0 || errorMsg || status) && (
            <div style={{ marginTop: 12 }}>
              <ProgressBar value={progress} />
              {status && <p className="text-xs" style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>{status}</p>}
              {errorMsg && <p className="text-xs" style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>Erreur : {errorMsg}</p>}
            </div>
          )}
        </article>
      </div>

      {/* Résumé IA */}
      <article className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 16, marginTop: 0, color: "#111827" }}>🧠 Résumé IA</h3>

        {!analysis && (
          <p className="text-sm" style={{ fontSize: 13, color: "#6b7280" }}>
            Importe une vidéo puis lance l’analyse pour obtenir le résumé ici.
          </p>
        )}

        {analysis && (
          <div style={{ display: "grid", gap: 12 }}>
            <div className="text-sm" style={{ fontSize: 13 }}>
              <span style={{ color: "#6b7280" }}>Exercice détecté :</span>{" "}
              <strong style={{ fontSize: 13 }}>{analysis.exercise || "inconnu"}</strong>
            </div>

            {analysis.overall?.trim() && (
              <p className="text-sm" style={{ fontSize: 13, lineHeight: 1.6 }}>
                {analysis.overall.trim()}
              </p>
            )}

            {analysis.muscles?.length > 0 && (
              <div>
                <h4 style={{ fontSize: 14, margin: "8px 0 4px", color: "#111827" }}>Muscles ciblés</h4>
                <p className="text-sm" style={{ fontSize: 13 }}>
                  {analysis.muscles.join(" - ")}
                </p>
              </div>
            )}

            {analysis.corrections?.length > 0 && (
              <div>
                <h4 style={{ fontSize: 14, margin: "8px 0 4px", color: "#111827" }}>Corrections proposées</h4>
                <ul style={{ fontSize: 13, paddingLeft: 18, lineHeight: 1.6 }}>
                  {analysis.corrections.map((c, i) => (
                    <li key={i} style={{ listStyle: "disc" }}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.faults?.length > 0 && (
              <div>
                <h4 style={{ fontSize: 14, margin: "8px 0 4px", color: "#111827" }}>Erreurs détectées</h4>
                <ul style={{ fontSize: 13, paddingLeft: 18, lineHeight: 1.6 }}>
                  {analysis.faults.map((f, i) => (
                    <li key={i} style={{ listStyle: "disc" }}>
                      <strong>{f.issue}</strong> — {f.correction}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.extras && analysis.extras.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 13, cursor: "pointer" }}>📎 Points complémentaires</summary>
                <ul style={{ fontSize: 13, paddingLeft: 18, marginTop: 6, lineHeight: 1.6 }}>
                  {analysis.extras.map((x, i) => (
                    <li key={i} style={{ listStyle: "disc" }}>{x}</li>
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
/* ===================== Upload / Record (stubs fonctionnels) ===================== */
function UploadDrop({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="border-2 border-dashed rounded-2xl p-6 text-center"
      style={{ fontSize: 13 }}
    >
      <div className="mx-auto h-8 w-8 mb-2">☁️</div>
      <p className="text-sm mb-2" style={{ fontSize: 13 }}>Glisse une vidéo ici ou</p>
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
          style={{ background: "#ffffff", color: "#111827", border: "1px solid #d1d5db", fontWeight: 500, fontSize: 13 }}
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
    <div className="space-y-3" style={{ fontSize: 13 }}>
      <div className="relative">
        <video ref={videoRef} className="w-full rounded-2xl border" muted playsInline />
        {!hasStream && (
          <div className="absolute inset-0 grid place-items-center text-xs" style={{ fontSize: 12, color: "#6b7280" }}>
            Prépare ta caméra puis clique « Démarrer »
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!isRecording ? (
          <button className="btn btn-dash" onClick={start} type="button" style={{ fontSize: 13 }}>▶️ Démarrer</button>
        ) : (
          <button
            className="btn"
            onClick={stop}
            type="button"
            style={{ background: "#ffffff", color: "#111827", border: "1px solid #d1d5db", fontWeight: 500, fontSize: 13 }}
          >
            ⏸️ Arrêter
          </button>
        )}
      </div>
    </div>
  );
}

/* ===== Helpers vidéo ===== */
function getBestMimeType() {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  for (const c of candidates) {
    // @ts-ignore
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "video/webm";
}

