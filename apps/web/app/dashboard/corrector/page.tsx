// apps/web/app/dashboard/corrector/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader, Section } from "@/components/ui/Page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
}

/* ===================== Constantes ===================== */
const CLIENT_PROXY_MAX_BYTES =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_PROXY_UPLOAD_MAX_BYTES
    ? Number(process.env.NEXT_PUBLIC_PROXY_UPLOAD_MAX_BYTES)
    : 5 * 1024 * 1024; // 5MB par défaut

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block align-[-0.125em] h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-label="loading"
    />
  );
}

/* ===================== Page ===================== */
export default function Page() {
  return (
    <>
      <PageHeader title="Files te corrige" subtitle="Conseils IA sur ta posture (démo)" />
      <Section title="Filmer / Notes">
        <p className="text-sm text-muted-foreground mb-4">
          Enregistre une vidéo, ajoute ton ressenti, puis lance l’analyse IA.
        </p>
        <CoachAnalyzer />
      </Section>
    </>
  );
}

/* ===================== Composant principal ===================== */
function CoachAnalyzer() {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [feeling, setFeeling] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Flux de confirmation
  const [predictedExercise, setPredictedExercise] = useState<string | null>(null);
  const [showChoiceGate, setShowChoiceGate] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideName, setOverrideName] = useState("");

  // Aperçu corrigé (toujours affiché dans Démonstration)
  const showAIPreview = true;

  // cooldown (429, 504)
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
    // reset
    setAnalysis(null);
    setErrorMsg("");
    setStatus("");
    setProgress(0);
    setPredictedExercise(null);
    setShowChoiceGate(false);
    setOverrideOpen(false);
    setOverrideName("");
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

  /** Lance l'analyse. Si `userExercise` est fourni, il est passé au backend pour forcer le contexte. */
  const onAnalyze = async (userExercise?: string) => {
    if (!file || isAnalyzing || cooldown > 0) return;

    setIsAnalyzing(true);
    setProgress(5);
    setStatus("Préparation des images…");
    setErrorMsg("");

    try {
      // 0) EXTRACTION — 12 frames -> 2 mosaïques 1280×720 (JPEG 0.6)
      const { frames, timestamps } = await extractFramesFromFile(file, 12);
      if (!frames.length) throw new Error("Impossible d’extraire des images de la vidéo.");
      setProgress(12);

      const half = Math.ceil(frames.length / 2);
      const mosaic1 = await makeMosaic(frames.slice(0, half), 3, 2, 1280, 720, 0.6);
      const mosaic2 = await makeMosaic(frames.slice(half), 3, 2, 1280, 720, 0.6);
      const mosaics = [mosaic1, mosaic2];
      const midTime = timestamps[Math.floor(timestamps.length / 2)] || 0;

      setProgress(20);

      // 1) UPLOAD — proxy si < 5MB, sinon signed upload direct
      setStatus("Upload de la vidéo…");
      let fileUrl: string | undefined;

      if (file.size > CLIENT_PROXY_MAX_BYTES) {
        setStatus("Fichier volumineux — upload signé…");
        const { readUrl } = await uploadWithSignedUrl(file);
        fileUrl = readUrl;
      } else {
        try {
          const url = await uploadWithProxy(file);
          fileUrl = url;
        } catch {
          setStatus("Proxy indisponible — upload signé…");
          const { readUrl } = await uploadWithSignedUrl(file);
          fileUrl = readUrl;
        }
      }

      if (!fileUrl) throw new Error("Upload échoué (aucune URL retournée)");
      setProgress(75);

      // 2) APPEL IA — FR + fautes + option "exercice indiqué par le client"
      void fakeProgress(setProgress, 80, 98);
      setStatus("Analyse IA…");

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
      };

      // 3) Proposer la confirmation avant d'afficher les détails
      setAnalysis(safe);
      setPredictedExercise(safe.exercise || "exercice_inconnu");
      setShowChoiceGate(true);
      setOverrideOpen(false);
      setProgress(100);
      setStatus("Analyse terminée — confirme l’exercice");
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || String(e);
      setErrorMsg(msg);
      setStatus("");
      alert(`Erreur pendant l'analyse: ${msg}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Actions de confirmation
  const confirmPredicted = () => {
    setShowChoiceGate(false);     // ➜ on montre les résultats
  };
  const openOverride = () => {
    setOverrideOpen(true);        // ➜ champ de saisie pour "Autre"
    setOverrideName("");
  };
  const submitOverride = async () => {
    if (!overrideName.trim()) return;
    await onAnalyze(overrideName.trim()); // relance avec le nom fourni
    setShowChoiceGate(false);             // on peut directement afficher les résultats
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
  };

  // ===== Helpers "Erreur détectée / Correction" =====
  function faultsToLines(a: AIAnalysis | null) {
    if (!a) return { issuesLine: "", correctionsLine: "" };
    const issues = (a.faults || [])
      .map(f => (f?.issue || "").trim())
      .filter(Boolean);
    const faultCorrections = (a.faults || [])
      .map(f => (f?.correction || "").trim())
      .filter(Boolean);

    const issuesLine = issues.join(" - ");
    const correctionsBase = faultCorrections.length ? faultCorrections : (a.corrections || []);
    const correctionsLine = (correctionsBase || []).join(" - ");
    return { issuesLine, correctionsLine };
  }
  const { issuesLine, correctionsLine } = faultsToLines(analysis);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Col 1: capture / upload */}
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle className="flex items-center gap-2">🎥 Capture / Import</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="record">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="record">Filmer</TabsTrigger>
              <TabsTrigger value="upload">Importer</TabsTrigger>
            </TabsList>

            <TabsContent value="record" className="space-y-3">
              <VideoRecorder onRecorded={(f) => handleUpload(f)} />
            </TabsContent>

            <TabsContent value="upload" className="space-y-3">
              <UploadDrop onFile={handleUpload} />
            </TabsContent>
          </Tabs>

          {blobUrl && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Aperçu</label>
              <video src={blobUrl} controls className="w-full rounded-2xl border" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate flex items-center gap-1">🎞️ {fileName ?? "clip.webm"}</span>
                <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={reset}>↺ Réinitialiser</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Col 2: Ton ressenti ? + envoi */}
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle className="flex items-center gap-2">🎙️ Ton ressenti ?</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Explique comment tu te sens (douleurs, fatigue, où tu as senti l'effort, RPE, etc.)."
            value={feeling}
            onChange={(e) => setFeeling(e.target.value)}
            className="min-h-[140px]"
          />
          <div className="flex items-center gap-2">
            <Button disabled={!blobUrl || isAnalyzing || cooldown > 0} onClick={() => onAnalyze()}>
              {isAnalyzing ? <Spinner className="mr-2" /> : <span className="mr-2">✨</span>}
              {isAnalyzing ? "Analyse en cours" : cooldown > 0 ? `Patiente ${cooldown}s` : "Lancer l'analyse IA"}
            </Button>
            <Button variant="secondary" disabled={isAnalyzing || cooldown > 0} onClick={() => setFeeling(exampleFeeling)}>
              Exemple de ressenti
            </Button>
          </div>

          {(isAnalyzing || progress > 0 || errorMsg || status) && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">{status}</p>
              {errorMsg && <p className="text-xs text-red-600 break-all">Erreur : {errorMsg}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Col 3: choix + résultats */}
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle className="flex items-center gap-2">🧠 Files te dit tout</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!analysis && (<EmptyState />)}

          {/* --- GATE DE CONFIRMATION --- */}
          {analysis && showChoiceGate && (
            <div className="space-y-3">
              <div className="flex items-center flex-wrap gap-2">
                <Badge variant="secondary">Exercice proposé : {predictedExercise || "exercice_inconnu"}</Badge>
              </div>
              <p className="text-sm">
                L’IA propose : <span className="font-medium">{predictedExercise || "exercice_inconnu"}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="h-8 px-3 text-xs"
                  onClick={confirmPredicted}
                  disabled={isAnalyzing}
                >
                  Confirmer « {predictedExercise || "exercice_inconnu"} »
                </Button>
                <Button
                  className="h-8 px-3 text-xs"
                  variant="secondary"
                  onClick={openOverride}
                  disabled={isAnalyzing}
                >
                  Autre
                </Button>
              </div>

              {overrideOpen && (
                <div className="mt-2 rounded-xl border p-3 space-y-2">
                  <label className="text-xs text-muted-foreground">Quel exercice fais-tu ?</label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="ex. Tractions, Fentes bulgares, Soulevé de terre…"
                      value={overrideName}
                      onChange={(e) => setOverrideName(e.target.value)}
                    />
                    <Button className="h-8 px-3 text-xs" onClick={submitOverride} disabled={isAnalyzing || !overrideName.trim()}>
                      Ré-analyser
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    L’IA va tenir compte de ce nom pour corriger plus précisément.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* --- RÉSULTATS APRÈS CONFIRMATION --- */}
          {analysis && !showChoiceGate && (
            <div className="space-y-4">
              {/* Exercice détecté / confirmé */}
              <div className="flex items-center flex-wrap gap-2">
                <Badge variant="secondary">Exercice : {analysis.exercise || "inconnu"}</Badge>
              </div>

              {/* Synthèse */}
              {analysis.overall?.trim() && (
                <p className="text-sm leading-relaxed">{analysis.overall.trim()}</p>
              )}

              {/* Muscles (avec " - " entre chaque) */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Muscles principalement sollicités</h4>
                {analysis.muscles?.length ? (
                  <p className="text-sm">{analysis.muscles.join(" - ")}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">— non détecté —</p>
                )}
              </div>

              {/* Bloc simplifié Erreurs / Correction */}
              {(issuesLine || correctionsLine) && (
                <div className="space-y-1">
                  {issuesLine && <p className="text-sm"><span className="font-medium">Erreur détectée :</span> {issuesLine}</p>}
                  {correctionsLine && <p className="text-sm"><span className="font-medium">Correction :</span> {correctionsLine}</p>}
                </div>
              )}

              {/* Extras (optionnel) */}
              {analysis.extras && analysis.extras.length > 0 && (
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="more">
                    <AccordionTrigger>Points complémentaires</AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        {analysis.extras.map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              {/* Timeline */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Repères dans la vidéo</h4>
                {analysis.timeline?.length ? (
                  <div className="space-y-2">
                    {analysis.timeline.map((p, idx) => (<TimelineRow key={`${p.time}-${idx}`} point={p} videoSelector="#analysis-player" />))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">— aucun repère temporel —</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Démonstration — uniquement l’aperçu corrigé par l’IA */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ▶️ Démonstration — aperçu corrigé par l’IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {blobUrl ? (
              <VideoWithOverlay
                id="analysis-player"
                src={blobUrl}
                analysis={analysis}
                showAIPreview={showAIPreview} // toujours true
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                Aucune vidéo. Enregistre ou importe un clip pour voir la démonstration.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
      Aucune analyse pour l'instant. Ajoute une vidéo et ton ressenti, puis clique <span className="font-medium">Lancer l'analyse IA</span>.
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>Posture</Badge><Badge>Amplitudes</Badge><Badge>Symétrie</Badge><Badge>Rythme</Badge>
      </div>
    </div>
  );
}

/* ===================== Player avec overlays IA ===================== */
function VideoWithOverlay({
  id,
  src,
  analysis,
  showAIPreview,
}: {
  id: string;
  src: string;
  analysis: AIAnalysis | null;
  showAIPreview: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Ajuste le canvas à la taille de la vidéo (net sur écrans HiDPI)
  const syncCanvasSize = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;

    // Taille CSS de la zone d’affichage
    const cssW = v.clientWidth || v.videoWidth || 640;
    const cssH = v.clientHeight || (v.videoHeight ? (cssW * v.videoHeight) / v.videoWidth : 360);

    // Bitmap 1:1 pixels réels pour éviter le flou (rétine / zoom)
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    c.width = Math.floor(cssW * dpr);
    c.height = Math.floor(cssH * dpr);
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;

    const ctx = c.getContext("2d");
    if (ctx) {
      // remet la matrice et applique le scale DPR
      // @ts-ignore
      ctx.reset?.();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  };

  const drawOverlay = () => {
    const c = canvasRef.current;
    const v = videoRef.current;
    if (!c || !v) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    // Efface
    ctx.clearRect(0, 0, c.width, c.height);

    if (!showAIPreview) return;

    // Teinte douce pour indiquer "aperçu IA"
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, 0, c.width, c.height);

    // Bandeau “IA : aperçu corrigé”
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(12, 12, 220, 28);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("IA : aperçu corrigé", 20, 31);

    // Heuristiques d’overlay en fonction des fautes
    const issues = (analysis?.faults || []).map(f => (f?.issue || "").toLowerCase());

    // 1) Dos trop cambré → ligne vertébrale corrigée + flèches
    if (issues.some(i => /dos|lordose|cambr/.test(i))) {
      drawSpineGuide(ctx as CanvasRenderingContext2D, c.width, c.height);
    }

    // 2) Genoux qui rentrent / jambes trop tendues → guides genoux
    if (issues.some(i => /genou|valgus/.test(i))) {
      drawKneeGuide(ctx as CanvasRenderingContext2D, c.width, c.height, { suggestBend: true });
    } else if (issues.some(i => /jambes? trop tendu|verrouill/.test(i))) {
      drawKneeGuide(ctx as CanvasRenderingContext2D, c.width, c.height, { suggestBend: true });
    }

    // 3) Tête projetée / nuque cassée → guide tête/nuque
    if (issues.some(i => /tête|nuque|cou/.test(i))) {
      drawHeadGuide(ctx as CanvasRenderingContext2D, c.width, c.height);
    }

    // 4) Pieds instables / talons qui se décollent → base de support
    if (issues.some(i => /pieds|talons?/.test(i))) {
      drawFeetGuide(ctx as CanvasRenderingContext2D, c.width, c.height);
    }
  };

  const loop = () => {
    drawOverlay();
    rafRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    syncCanvasSize();
  }, [src]);

  useEffect(() => {
    const onResize = () => syncCanvasSize();
    window.addEventListener("resize", onResize);
    syncCanvasSize();
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAIPreview, analysis]);

  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-2xl border">
      <video
        id={id}
        ref={videoRef}
        src={src}
        controls
        className="block h-full w-full object-contain"
        onLoadedMetadata={syncCanvasSize}
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-10"
        aria-hidden="true"
      />
    </div>
  );
}

/* === Fonctions de dessin simples (visualisation “corrigée”) === */
function drawSpineGuide(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const x = Math.round(w * 0.5);
  ctx.strokeStyle = "#22c55e"; // vert
  ctx.lineWidth = 4;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(x, Math.round(h * 0.2));
  ctx.lineTo(x, Math.round(h * 0.85));
  ctx.stroke();
  ctx.setLineDash([]);

  // Flèches latérales (rentrer les côtes)
  drawArrow(ctx, x - Math.round(w * 0.18), Math.round(h * 0.45), x - Math.round(w * 0.04), Math.round(h * 0.45), "#22c55e");
  drawArrow(ctx, x + Math.round(w * 0.18), Math.round(h * 0.45), x + Math.round(w * 0.04), Math.round(h * 0.45), "#22c55e");

  drawTag(ctx, x + 10, Math.round(h * 0.22), "Dos neutre / gaine le tronc");
}

function drawKneeGuide(ctx: CanvasRenderingContext2D, w: number, h: number, opts: { suggestBend?: boolean } = {}) {
  const left = Math.round(w * 0.35);
  const right = Math.round(w * 0.65);
  const footY = Math.round(h * 0.88);
  const kneeY = Math.round(h * 0.68);

  ctx.strokeStyle = "#3b82f6"; // bleu
  ctx.lineWidth = 3;

  // Pieds (base)
  ctx.beginPath();
  ctx.moveTo(left - 30, footY);
  ctx.lineTo(left + 30, footY);
  ctx.moveTo(right - 30, footY);
  ctx.lineTo(right + 30, footY);
  ctx.stroke();

  // Genoux (corrigé : au-dessus et alignés)
  ctx.beginPath();
  ctx.moveTo(left, kneeY);
  ctx.lineTo(left, footY);
  ctx.moveTo(right, kneeY);
  ctx.lineTo(right, footY);
  ctx.stroke();

  if (opts.suggestBend) {
    drawArrow(ctx, left, kneeY - 30, left, kneeY + 5, "#3b82f6");
    drawArrow(ctx, right, kneeY - 30, right, kneeY + 5, "#3b82f6");
    drawTag(ctx, right + 12, kneeY - 24, "Fléchis légèrement les genoux");
  } else {
    drawTag(ctx, right + 12, kneeY - 24, "Genoux alignés sur pieds");
  }
}

function drawHeadGuide(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const y = Math.round(h * 0.18);
  ctx.strokeStyle = "#f59e0b"; // orange
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(Math.round(w * 0.1), y);
  ctx.lineTo(Math.round(w * 0.9), y);
  ctx.stroke();
  ctx.setLineDash([]);

  drawArrow(ctx, Math.round(w * 0.55), y - 20, Math.round(w * 0.5), y + 6, "#f59e0b");
  drawTag(ctx, Math.round(w * 0.56), y + 10, "Rentre légèrement le menton");
}

function drawFeetGuide(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const x = Math.round(w * 0.25);
  const y = Math.round(h * 0.86);
  const width = Math.round(w * 0.5);
  const height = Math.round(h * 0.06);
  ctx.fillStyle = "rgba(250, 204, 21, 0.25)";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#eab308";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  drawTag(ctx, x + width + 10, y + 6, "Reste ancré dans le sol");
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = "#22c55e") {
  const headlen = 10;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
  ctx.lineTo(x2, y2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawTag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const padX = 8, padY = 6;
  const textW = Math.ceil(ctx.measureText(text).width);
  const boxW = textW + padX * 2;
  const boxH = 24;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x, y, boxW, boxH);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x + padX, y + boxH - padY - 2);
}

/* ===================== Timeline Row ===================== */
function TimelineRow({ point, videoSelector }: { point: AnalysisPoint; videoSelector: string }) {
  const onSeek = () => {
    const video = document.querySelector<HTMLVideoElement>(videoSelector);
    if (video) { video.currentTime = point.time; video.play(); }
  };
  return (
    <button onClick={onSeek} className="w-full text-left rounded-xl border p-3 hover:bg-accent transition">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{fmtTime(point.time)} – {point.label}</span>
        <span className="text-xs text-muted-foreground">Aller au moment</span>
      </div>
      {point.detail && <p className="text-xs text-muted-foreground mt-1">{point.detail}</p>}
    </button>
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
        <Input ref={inputRef} type="file" accept="video/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>Choisir un fichier</Button>
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
        {!isRecording ? (<Button onClick={start}>▶️ Démarrer</Button>) : (<Button variant="destructive" onClick={stop}>⏸️ Arrêter</Button>)}
      </div>
    </div>
  );
}

/* ===== Helpers vidéo / images ===== */

const exampleFeeling =
  "Séance de squats. RPE 8. Genou droit un peu instable, bas du dos fatigué, j'ai surtout senti les quadris brûler sur les dernières reps.";

function fmtTime(s: number) {
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

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
    video.crossOrigin = "anonymous";
    (video as any).muted = true;
    (video as any).playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Impossible de lire la vidéo côté client."));
    });

    const duration = Math.max(0.001, (video as any).duration || 0);
    const times: number[] = [];
    if (nFrames <= 1) {
      times.push(Math.min(duration, 0.1));
    } else {
      for (let i = 0; i < nFrames; i++) {
        const t = (duration * (i + 1)) / (nFrames + 1); // réparti
        times.push(t);
      }
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const frames: string[] = [];
    const timestamps: number[] = [];

    const targetW = 640;
    const targetH = 360;

    for (const t of times) {
      await seek(video as any, t);
      const vw = (video as any).videoWidth || targetW;
      const vh = (video as any).videoHeight || targetH;
      const { width, height } = bestFit(vw, vh, targetW, targetH);
      canvas.width = width;
      canvas.height = height;
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

/** Construit une mosaïque WxH depuis une liste d’images (dataURL). */
async function makeMosaic(images: string[], gridW = 3, gridH = 2, outW = 1280, outH = 720, quality = 0.6): Promise<string> {
  const cvs = document.createElement("canvas");
  const ctx = cvs.getContext("2d")!;
  cvs.width = outW;
  cvs.height = outH;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, outW, outH);

  const cellW = Math.floor(outW / gridW);
  const cellH = Math.floor(outH / gridH);

  for (let i = 0; i < Math.min(images.length, gridW * gridH); i++) {
    const img = await loadImage(images[i]);
    const x = (i % gridW) * cellW;
    const y = Math.floor(i / gridW) * cellH;

    const { width, height } = bestFit(img.width, img.height, cellW, cellH);
    const dx = x + Math.floor((cellW - width) / 2);
    const dy = y + Math.floor((cellH - height) / 2);
    ctx.drawImage(img, dx, dy, width, height);
  }

  return cvs.toDataURL("image/jpeg", quality);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l’image."));
    img.src = src;
  });
}

