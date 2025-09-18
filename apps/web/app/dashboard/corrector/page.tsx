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
import { supabase } from "@/lib/supabase";

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block align-[-0.125em] h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-label="loading"
    />
  );
}

interface AnalysisPoint { time: number; label: string; detail?: string; }
interface AIAnalysis {
  exercise: string;
  confidence: number; // 0..1
  overall: string;
  muscles: string[];
  cues: string[];
  extras?: string[];
  timeline: AnalysisPoint[];
}

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

function CoachAnalyzer() {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [feeling, setFeeling] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [progress, setProgress] = useState(0);

  // UX/debug
  const [status, setStatus] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Cooldown & mode éco (éco par défaut)
  const [cooldown, setCooldown] = useState(0);
  const [economyMode, setEconomyMode] = useState(true);

  useEffect(() => {
    if (!cooldown) return;
    const id = setInterval(() => setCooldown((s) => (s > 1 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    setFileName(file.name);
    setFile(file);
    setAnalysis(null);
    setErrorMsg("");
    setStatus("");
  };

  const onAnalyze = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setProgress(5);
    setStatus("");
    setErrorMsg("");

    try {
      // 0) FABRIQUER UNE MOSAÏQUE (4 mini-frames -> 1 image)
      setProgress(10);
      const n = 4; // 2x2
      const { frame: mosaic, timestamps } = await extractMosaicFromFile(file, n, economyMode ? 0.45 : 0.5);
      if (!mosaic) throw new Error("Impossible de créer la mosaïque.");

      // 1) URL d’upload signée
      const resSign = await fetch("/api/storage/sign-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
        }),
      });
      if (!resSign.ok) {
        const txt = await resSign.text().catch(() => "");
        throw new Error(`sign-upload: HTTP ${resSign.status} ${txt}`);
      }
      const { path, token } = await resSign.json();
      if (!path || !token) throw new Error("sign-upload: réponse invalide (pas de path/token)");
      setProgress(35);

      // 2) Upload vers Supabase (signed URL)
      const { error: upErr } = await supabase
        .storage
        .from("videos")
        .uploadToSignedUrl(path, token, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) throw new Error(`uploadToSignedUrl: ${upErr.message || "Load failed"}`);
      setProgress(60);

      // 3) URL de lecture signée
      const resRead = await fetch("/api/storage/sign-read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path, expiresIn: 60 * 60 }), // 1h
      });
      if (!resRead.ok) {
        const txt = await resRead.text().catch(() => "");
        throw new Error(`sign-read: HTTP ${resRead.status} ${txt}`);
      }
      const { url: fileUrl } = await resRead.json();
      if (!fileUrl) throw new Error("sign-read: réponse invalide (pas d’url)");
      setProgress(80);

      // 4) Appel IA (avec mosaïque)
      void fakeProgress(setProgress);

      const middleTs = timestamps[Math.floor(timestamps.length / 2)] ?? 0;
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          frames: [mosaic],                 // ✅ 1 seule image
          timestamps: [middleTs],
          feeling,
          fileUrl,
          economyMode,                      // éco par défaut (true)
        }),
      });

      const text = await res.text().catch(() => "");

      if (!res.ok) {
        if (res.status === 429 || /rate_limit_exceeded/i.test(text)) {
          const retryAfterHeader = res.headers.get("retry-after");
          const retryAfterSec = retryAfterHeader ? Math.max(1, parseInt(retryAfterHeader, 10) || 0) : 60;
          setErrorMsg(`La limite d’usage du modèle est atteinte. Réessaie dans ~${retryAfterSec}s.`);
          setStatus("Limite atteinte (429).");
          setCooldown(retryAfterSec);
          setEconomyMode(true); // rester en mode éco
          throw new Error("rate_limit_exceeded");
        }
        throw new Error(`analyze: HTTP ${res.status} ${text}`);
      }

      const data: Partial<AIAnalysis> = JSON.parse(text);

      const safe: AIAnalysis = {
        exercise: (data.exercise || "exercice_inconnu").toString(),
        confidence: typeof data.confidence === "number" ? data.confidence : 0.5,
        overall:
          (typeof data.overall === "string" && data.overall.trim()) ||
          "Analyse effectuée mais je manque d’indices visuels. Réessaie avec un angle plus net ou un cadrage entier.",
        muscles: Array.isArray(data.muscles) && data.muscles.length ? data.muscles.slice(0, 8) : [],
        cues: Array.isArray(data.cues) && data.cues.length ? data.cues : [],
        extras: Array.isArray(data.extras) ? data.extras : [],
        timeline:
          Array.isArray(data.timeline)
            ? data.timeline.filter(v => typeof v?.time === "number" && typeof v?.label === "string")
            : [],
      };

      setAnalysis(safe);
      setProgress(100);
      setStatus("Terminé ✅");
      setErrorMsg("");
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || String(e);
      setErrorMsg(msg);
      if (!/429|rate[_\s-]?limit/i.test(msg)) {
        alert(`Erreur pendant l'analyse: ${msg}`);
      }
    } finally {
      setIsAnalyzing(false);
    }
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
    setEconomyMode(true); // rester prudent par défaut
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Col 1: capture / upload */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">🎥 Capture / Import</CardTitle>
        </CardHeader>
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

      {/* Col 2: ressenti + envoi */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">🎙️ Ressenti du client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Dis-nous comment tu te sens (douleurs, fatigue, où tu as senti l'effort, RPE, etc.)."
            value={feeling}
            onChange={(e) => setFeeling(e.target.value)}
            className="min-h-[140px]"
          />
          <div className="flex items-center gap-2">
            <Button disabled={!blobUrl || isAnalyzing || cooldown > 0} onClick={onAnalyze}>
              {isAnalyzing ? <Spinner className="mr-2" /> : <span className="mr-2">✨</span>}
              {cooldown > 0
                ? `Réessaie dans ${cooldown}s`
                : (isAnalyzing ? "Analyse en cours" : "Lancer l'analyse IA")}
            </Button>
            <Button variant="secondary" disabled={isAnalyzing} onClick={() => setFeeling(exampleFeeling)}>
              Exemple de ressenti
            </Button>
          </div>

          {(isAnalyzing || progress > 0 || errorMsg) && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                {isAnalyzing ? "Chargement…" : status || (progress === 100 ? "Terminé ✅" : "")}
              </p>
              {errorMsg && (
                <p className="text-xs text-red-600 break-all">
                  {`Erreur : ${errorMsg}`}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Col 3: résultats */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">🏋️ Retour IA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!analysis && (<EmptyState />)}

          {analysis && (
            <div className="space-y-4">
              <div className="flex items-center flex-wrap gap-2">
                <Badge variant="secondary">
                  Exercice détecté : {analysis.exercise || "inconnu"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Confiance : {Math.round((analysis.confidence ?? 0) * 100)}%
                </span>
              </div>

              <div>
                <p className="text-sm leading-relaxed">
                  {analysis.overall?.trim() || "Pas d’observations précises. Réessaie avec un angle plus net / cadrage entier."}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Muscles principalement sollicités</h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.muscles?.length
                    ? analysis.muscles.map((m) => (<Badge key={m} variant="secondary">{m}</Badge>))
                    : <span className="text-xs text-muted-foreground">— non détecté —</span>}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Cues / corrections</h4>
                {analysis.cues?.length ? (
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {analysis.cues.map((c, i) => (<li key={i}>{c}</li>))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">— pas de consignes spécifiques détectées —</p>
                )}
              </div>

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

      {/* Player global */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2">▶️ Démonstration / Lecture</CardTitle></CardHeader>
          <CardContent>
            {blobUrl ? (
              <video id="analysis-player" src={blobUrl} controls className="w-full rounded-2xl border" />
            ) : (
              <div className="text-sm text-muted-foreground">Aucune vidéo. Enregistre ou importe un clip pour voir les repères.</div>
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
        await videoRef.current.play();
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
      mr.start(); setIsRecording(true);
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
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "video/webm";
}

async function fakeProgress(setter: (v: number) => void) {
  for (let i = 12; i <= 95; i += Math.floor(Math.random() * 10) + 3) {
    await new Promise((r) => setTimeout(r, 220));
    setter(Math.min(i, 95));
  }
  await new Promise((r) => setTimeout(r, 350));
  setter(100);
}

/* ====== Extraction + mosaïque (1 image) ====== */

/** Extrait N mini-frames, puis les assemble en une mosaïque 2x2 JPEG légère. */
async function extractMosaicFromFile(
  file: File,
  nFrames = 4,
  quality = 0.5
): Promise<{ frame: string; timestamps: number[] }> {
  const { frames, timestamps } = await extractFramesRaw(file, nFrames, 480, 270, quality);
  const mosaic = await makeMosaic(frames, 2, 2, quality); // 2x2
  return { frame: mosaic, timestamps };
}

/** Extraction “raw” des petites frames. */
async function extractFramesRaw(
  file: File,
  nFrames = 4,
  targetW = 480,
  targetH = 270,
  quality = 0.5
): Promise<{ frames: string[]; timestamps: number[] }> {
  const videoURL = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = videoURL; video.crossOrigin = "anonymous"; video.muted = true; video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Impossible de lire la vidéo côté client."));
    });

    const duration = Math.max(0.001, video.duration || 0);
    const times: number[] = [];
    for (let i = 0; i < nFrames; i++) times.push((duration * (i + 1)) / (nFrames + 1));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const frames: string[] = [];
    const timestamps: number[] = [];

    for (const t of times) {
      await seek(video, t);
      const { width, height } = bestFit(video.videoWidth, video.videoHeight, targetW, targetH);
      canvas.width = width; canvas.height = height;
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      frames.push(dataUrl);
      timestamps.push(Math.round(t));
    }

    return { frames, timestamps };
  } finally {
    URL.revokeObjectURL(videoURL);
  }
}

/** Assemble un tableau de dataURL JPEG en mosaïque CxR, renvoie un dataURL JPEG. */
async function makeMosaic(dataUrls: string[], cols = 2, rows = 2, quality = 0.5): Promise<string> {
  const imgs = await Promise.all(dataUrls.slice(0, cols * rows).map(loadImage));
  const cellW = 360, cellH = 202; // petite taille pour réduire les tokens
  const w = cols * cellW, h = rows * cellH;

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  for (let idx = 0; idx < imgs.length; idx++) {
    const img = imgs[idx];
    const x = (idx % cols) * cellW;
    const y = Math.floor(idx / cols) * cellH;
    const { width, height } = bestFit(img.naturalWidth, img.naturalHeight, cellW, cellH);
    const ox = x + Math.floor((cellW - width) / 2);
    const oy = y + Math.floor((cellH - height) / 2);
    ctx.drawImage(img, ox, oy, width, height);
  }

  return canvas.toDataURL("image/jpeg", quality);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* ====== Utilitaires communs ====== */

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
    try { video.currentTime = Math.min(Math.max(0, time), video.duration || time); } catch { /* ignore */ }
  });
}

function bestFit(w: number, h: number, maxW: number, maxH: number) {
  if (!w || !h) return { width: maxW, height: maxH };
  const r = Math.min(maxW / w, maxH / h);
  return { width: Math.round(w * r), height: Math.round(h * r) };
}
