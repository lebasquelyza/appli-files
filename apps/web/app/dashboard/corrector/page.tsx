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
    : 5 * 1024 * 1024; // 5MB par défaut

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block align-[-0.125em] h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-label="loading"
    />
  );
}

/* ===================== Vocabulaire & Variations (étendu) ===================== */

// --- Random helpers ---
function randInt(max: number) {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % max;
  }
  return Math.floor(Math.random() * max);
}
function pick<T>(arr: T[]): T { return arr[randInt(arr.length)]; }

// --- Lexique FR (style coach) ---
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

// --- Catégories d’exos ---
type Category =
  | "squat" | "lunge" | "hinge" | "hipthrust" | "legpress"
  | "quad_iso" | "ham_iso" | "calf"
  | "pull_vertical" | "pull_horizontal" | "row_chest" | "face_pull"
  | "push_horizontal" | "push_vertical" | "dip" | "pushup" | "fly" | "lateral_raise" | "front_raise" | "rear_delt"
  | "biceps" | "triceps"
  | "core_plank" | "core_anti_rotation" | "core_flexion"
  | "carry" | "sled"
  | "unknown";

// --- Aliases d’exercices -> catégories (regex en minuscules) ---
const EXO_ALIASES: Array<{ rx: RegExp; cat: Category }> = [
  // Bas du corps – genou dominant
  { rx: /(squat|front\s*squat|goblet|hack\s*squat|sissy)/, cat: "squat" },
  { rx: /(lunge|fente|split\s*squat|walking\s*lunge|bulgarian)/, cat: "lunge" },
  { rx: /(leg\s*press|presse\s*à\s*jambes)/, cat: "legpress" },
  { rx: /(leg\s*extension|extension\s*quadriceps)/, cat: "quad_iso" },

  // Bas du corps – hanche dominante
  { rx: /(deadlift|soulev|hinge|rdl|romanian|good\s*morning|hip\s*hinge)/, cat: "hinge" },
  { rx: /(hip\s*thrust|pont\s*de\s*hanches|glute\s*bridge)/, cat: "hipthrust" },
  { rx: /(leg\s*curl|ischio|hamstring\s*curl)/, cat: "ham_iso" },
  { rx: /(calf|mollet|élévation\s*mollets|standing\s*calf|seated\s*calf)/, cat: "calf" },

  // Dos – tirages
  { rx: /(pull[-\s]?up|traction)/, cat: "pull_vertical" },
  { rx: /(lat\s*pulldown|tirage\s*vertical)/, cat: "pull_vertical" },
  { rx: /(row|tirage\s*horizontal|barbell\s*row|pendlay|cable\s*row|seated\s*row)/, cat: "pull_horizontal" },
  { rx: /(chest\s*supported\s*row|row\s*appui\s*pector)/, cat: "row_chest" },
  { rx: /(face\s*pull)/, cat: "face_pull" },

  // Pecs/épaules – poussées
  { rx: /(bench|développé\s*couché|décliné|incliné)/, cat: "push_horizontal" },
  { rx: /(ohp|overhead|militaire|shoulder\s*press|arnold)/, cat: "push_vertical" },
  { rx: /(push[-\s]?up|pompe)/, cat: "pushup" },
  { rx: /(dip|dips)/, cat: "dip" },
  { rx: /(fly|écarté|pec\s*deck)/, cat: "fly" },
  { rx: /(lateral\s*raise|élévation\s*latérale)/, cat: "lateral_raise" },
  { rx: /(front\s*raise|élévation\s*frontale)/, cat: "front_raise" },
  { rx: /(rear\s*delt|oiseau|reverse\s*fly)/, cat: "rear_delt" },

  // Bras
  { rx: /(curl|biceps)/, cat: "biceps" },
  { rx: /(triceps|pushdown|extension\s*triceps|kickback|overhead\s*extension)/, cat: "triceps" },

  // Core
  { rx: /(plank|planche|side\s*plank|gainage\s*latéral|hollow)/, cat: "core_plank" },
  { rx: /(pallof|anti[-\s]?rotation|carry\s*offset)/, cat: "core_anti_rotation" },
  { rx: /(crunch|sit[-\s]?up|leg\s*raise|mountain\s*climber|russian\s*twist)/, cat: "core_flexion" },

  // Conditioning/fortifiants
  { rx: /(farmer|carry)/, cat: "carry" },
  { rx: /(sled|prowler|traîneau)/, cat: "sled" },
];

function getCategory(exo: string): Category {
  const s = (exo || "").toLowerCase();
  for (const { rx, cat } of EXO_ALIASES) if (rx.test(s)) return cat;
  return "unknown";
}

// Assainir/varier certains termes
function varyTerms(s: string) {
  if (!s) return s;
  let out = s;

  // bannir "tronc"
  out = out.replace(/\btronc\b/gi, pick(LEX.core));

  // standardiser quelques mots en version coach (variations)
  out = out
    .replace(/\bcolonne\b/gi, pick(LEX.neutralSpine))
    .replace(/\bdos droit\b/gi, pick(LEX.neutralSpine))
    .replace(/\bdos plat\b/gi, pick(LEX.neutralSpine))
    .replace(/\bcore\b/gi, pick(LEX.core))
    .replace(/\btenez\b/gi, "garde")
    .replace(/\bmaintenez\b/gi, "garde");

  return out;
}

// Déduplique + mélange
function uniqueShuffle(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const key = s.toLowerCase().trim();
    if (!seen.has(key)) { seen.add(key); out.push(s); }
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Génération de corrections variées selon la catégorie
function makeCorrections(exo: string) {
  const cat = getCategory(exo);
  const tips: string[] = [];

  // Universels posture & respiration
  const universal = [
    `Garde un ${pick(LEX.neutralSpine)} avec ${pick(LEX.chestUp)}.`,
    `${pick(LEX.breathe)}.`,
    `${pick(LEX.wristNeutral)} et ${pick(LEX.headNeutral)}.`,
  ];

  // Stabilité ceinture scapulaire/prise (haut du corps)
  const upperStab = [
    `${pick(LEX.shoulderPack)}.`,
    `${pick(LEX.grip)}.`,
  ];

  // Stabilité bassin & pieds (bas du corps)
  const lowerStab = [
    `${pick(LEX.footTripod)}.`,
    `${pick(LEX.kneeTrack)}.`,
  ];

  // Catégories
  switch (cat) {
    case "squat":
      tips.push(
        `${pick(LEX.kneeTrack)}.`,
        `${pick(LEX.footTripod)}.`,
        `${pick(LEX.chestUp)}; descends en ${pick(LEX.controlCue)}.`,
        `${pick(LEX.avoidMomentum)} — ${pick(LEX.tempoIntro)} ${pick(LEX.tempo311)}.`
      );
      break;

    case "lunge":
      tips.push(
        `Fais un grand pas, ${pick(LEX.kneeTrack)}.`,
        `Tronc haut, ${pick(LEX.neutralSpine)}; ${pick(LEX.controlCue)}.`,
        `Stabilise le bassin (${pick(LEX.core)[0]}).`,
        `${pick(LEX.tempoIntro)} ${pick(LEX.tempo201)}.`
      );
      break;

    case "hinge":
      tips.push(
        `${pick(LEX.hipBack)}; genoux souples.`,
        `${pick(LEX.neutralSpine)}; ${pick(LEX.scapRetract)}.`,
        `${pick(LEX.grip)} et barre proche du corps.`,
        `${pick(LEX.tempoIntro)} ${pick(LEX.tempo311)}.`
      );
      break;

    case "hipthrust":
      tips.push(
        `Roule le bassin en rétroversion en haut; ${pick(LEX.holdTop)}.`,
        `${pick(LEX.neutralSpine)} au point haut.`,
        `${pick(LEX.controlCue)}; ${pick(LEX.breathe)}.`
      );
      break;

    case "legpress":
      tips.push(
        `${pick(LEX.kneeTrack)}; pieds ni trop hauts ni trop bas.`,
        `${pick(LEX.controlCue)}, colle le bas du dos au dossier (${pick(LEX.neutralSpine)}).`,
        `${pick(LEX.avoidMomentum)}.`
      );
      break;

    case "quad_iso":
      tips.push(
        `${pick(LEX.controlCue)}; verrou en haut sans claquer le genou.`,
        `${pick(LEX.tempoIntro)} ${pick(LEX.tempo311)}.`,
        `${pick(LEX.breathe)}.`
      );
      break;

    case "ham_iso":
      tips.push(
        `${pick(LEX.controlCue)}; hanches stables.`,
        `${pick(LEX.tempoIntro)} ${pick(LEX.tempo311)}.`,
        `Pas d’à-coups, ressens l’ischio sur toute l’amplitude.`
      );
      break;

    case "calf":
      tips.push(
        `${pick(LEX.controlCue)}; arrêt net en bas, ${pick(LEX.holdTop)}.`,
        `${pick(LEX.rangeCue)}.`,
        `${pick(LEX.tempoIntro)} ${pick(LEX.tempo311)}.`
      );
      break;

    case "pull_vertical":
      tips.push(
        `${pick(LEX.latDepress)} avant de tirer; ${pick(LEX.elbowPathPull)}.`,
        `${pick(LEX.shoulderPack)}.`,
        `${pick(LEX.avoidMomentum)}.`
      );
      break;

    case "pull_horizontal":
    case "row_chest":
      tips.push(
        `${pick(LEX.scapRetract)}; ${pick(LEX.elbowPathPull)}.`,
        `${pick(LEX.wristNeutral)}.`,
        `${pick(LEX.controlCue)}, concentre-toi sur le dos.`
      );
      break;

    case "face_pull":
      tips.push(
        `Coudes hauts, tire vers le visage; vise l’extern rot.`,
        `${pick(LEX.shoulderPack)}.`,
        `${pick(LEX.controlCue)}.`
      );
      break;

    case "push_horizontal":
      tips.push(
        `${pick(LEX.elbowPathPush)}.`,
        `${pick(LEX.shoulderPack)} sur le banc.`,
        `${pick(LEX.wristNeutral)}; ${pick(LEX.avoidMomentum)}.`
      );
      break;

    case "push_vertical":
      tips.push(
        `${pick(LEX.elbowPathPush)} (barre au-dessus de la ligne d’oreilles).`,
        `${pick(LEX.core)[0]} solide; fessiers contractés.`,
        `${pick(LEX.wristNeutral)}; ${pick(LEX.controlCue)}.`
      );
      break;

    case "dip":
      tips.push(
        `Corps légèrement penché; coudes suivent la trajectoire, pas d’épaules qui montent.`,
        `${pick(LEX.shoulderPack)}.`,
        `${pick(LEX.controlCue)}.`
      );
      break;

    case "pushup":
      tips.push(
        `${pick(LEX.elbowPathPush)}; ${pick(LEX.neutralSpine)} (pas de bassin qui s’affaisse).`,
        `${pick(LEX.core)[0]} serrée tout du long.`,
        `${pick(LEX.avoidMomentum)} — ${pick(LEX.tempoIntro)} ${pick(LEX.tempo201)}.`
      );
      break;

    case "fly":
      tips.push(
        `${pick(LEX.controlCue)}; coudes légèrement fléchis constants.`,
        `${pick(LEX.shoulderPack)}.`,
        `${pick(LEX.rangeCue)} sans douleur.`
      );
      break;

    case "lateral_raise":
      tips.push(
        `Élévation par le côté, pouces légèrement vers le sol/ neutres.`,
        `${pick(LEX.shoulderPack)}; évite de “tricher” avec l’élan.`,
        `${pick(LEX.tempoIntro)} ${pick(LEX.tempo311)}.`
      );
      break;

    case "front_raise":
      tips.push(
        `Montée frontale sans cambrer; ${pick(LEX.core)[0]} active.`,
        `${pick(LEX.controlCue)}.`,
        `${pick(LEX.wristNeutral)}.`
      );
      break;

    case "rear_delt":
      tips.push(
        `Buste penché, tire par les coudes, pas par les mains.`,
        `${pick(LEX.scapRetract)} sans hausser les épaules.`,
        `${pick(LEX.controlCue)}.`
      );
      break;

    case "biceps":
      tips.push(
        `${pick(LEX.wristNeutral)}; coudes fixes près du buste.`,
        `${pick(LEX.avoidMomentum)}.`,
        `${pick(LEX.tempoIntro)} ${pick(LEX.tempo311)}.`
      );
      break;

    case "triceps":
      tips.push(
        `Coudes stables, près de la tête/du buste selon la variante.`,
        `${pick(LEX.wristNeutral)}; ${pick(LEX.controlCue)}.`,
        `${pick(LEX.breathe)}.`
      );
      break;

    case "core_plank":
      tips.push(
        `${pick(LEX.neutralSpine)}; rétroversion légère du bassin.`,
        `${pick(LEX.braceVerb)} ta ${pick(LEX.core)}.`,
        `Respiration calme, tension constante.`
      );
      break;

    case "core_anti_rotation":
      tips.push(
        `Résiste à la rotation; épaules et hanches carrées.`,
        `${pick(LEX.braceVerb)} la ${pick(LEX.core)}.`,
        `${pick(LEX.controlCue)}.`
      );
      break;

    case "core_flexion":
      tips.push(
        `Roulement vertèbre par vertèbre; pas de tirage nuque.`,
        `${pick(LEX.braceVerb)} la ${pick(LEX.core)} et souffle en montée.`,
        `${pick(LEX.controlCue)}.`
      );
      break;

    case "carry":
      tips.push(
        `${pick(LEX.braceVerb)} la ${pick(LEX.core)}; épaules basses.`,
        `Démarche contrôlée, projection verticale haute.`,
        `${pick(LEX.grip)}.`
      );
      break;

    case "sled":
      tips.push(
        `Inclinaison du buste selon la charge; poussée continue.`,
        `${pick(LEX.footTripod)}; ${pick(LEX.kneeTrack)}.`,
        `${pick(LEX.avoidMomentum)}.`
      );
      break;

    default:
      tips.push(
        `Contrôle l’amplitude et garde un ${pick(LEX.neutralSpine)}.`,
        `${pick(LEX.braceVerb)} ta ${pick(LEX.core)} pour rester stable.`,
        `${pick(LEX.avoidMomentum)}.`
      );
      break;
  }

  // Ajoute 1–2 universels contextuels
  if (["pull_vertical","pull_horizontal","row_chest","face_pull","push_horizontal","push_vertical","dip","pushup","fly","lateral_raise","front_raise","rear_delt","biceps","triceps"].includes(cat)) {
    tips.push(pick(upperStab));
  } else if (["squat","lunge","hinge","hipthrust","legpress","quad_iso","ham_iso","calf"].includes(cat)) {
    tips.push(pick(lowerStab));
  } else {
    tips.push(pick(universal));
  }

  // Une phrase “tempo/contrôle” bonus au hasard
  if (randInt(2) === 0) tips.push(`${pick(LEX.tempoIntro)} ${pick(randInt(2) ? LEX.tempo201 : LEX.tempo311)}.`);

  return uniqueShuffle(tips);
}

/* ===================== Page ===================== */
export default function Page() {
  return (
    <>
      <PageHeader title="Files te corrige" subtitle="Conseils IA sur ta technique — sans 3D" />
      <Section title="Filmer / Notes">
        <p className="text-sm text-muted-foreground mb-4">
          Enregistre une vidéo, ajoute ton ressenti, puis lance l’analyse IA. <br />
          📝 L’IA te donne un résumé et des corrections — <i>ta vidéo n’est jamais affichée</i>.
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

  // Exercice confirmé par l'utilisateur
  const [confirmedExercise, setConfirmedExercise] = useState<string | null>(null);

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
    setConfirmedExercise(null); // reset confirmé
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

      // 2) APPEL IA
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
        skeleton_cues: Array.isArray((data as any)?.skeleton_cues) ? (data as any).skeleton_cues : [],
      };

      /* ===== Post-traitement "style coach" + variations ===== */
      // 1) Variations sur le texte brut
      safe.overall = varyTerms(safe.overall);

      // 2) Variations sur les fautes/corrections IA
      safe.faults = (safe.faults || []).map((f) => ({
        ...f,
        issue: varyTerms(f.issue || ""),
        correction: varyTerms(f.correction || ""),
      }));

      // 3) Génère un lot de corrections variées et mélange avec celles de l’IA
      safe.corrections = uniqueShuffle([
        ...makeCorrections(safe.exercise || ""),
        ...(safe.corrections || []).map(varyTerms),
      ]).slice(0, 5); // 3–5 lignes lisibles

      // 4) Optionnel : reformater les muscles
      safe.muscles = (safe.muscles || []).map(varyTerms);

      // 3) Proposer la confirmation avant d'afficher les détails
      setAnalysis(safe);
      setPredictedExercise(safe.exercise || "exercice_inconnu");
      if (userExercise && userExercise.trim()) {
        setConfirmedExercise(userExercise.trim());
        setShowChoiceGate(false);
      } else {
        setShowChoiceGate(true);
      }
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
    setConfirmedExercise(predictedExercise || null);
    setShowChoiceGate(false);
  };
  const openOverride = () => { setOverrideOpen(true); setOverrideName(""); };
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

  // ===== Helpers "Erreur détectée / Correction" =====
  function faultsToLines(a: AIAnalysis | null) {
    if (!a) return { issuesLine: "", correctionsLine: "" };
    const issues = (a?.faults || []).map(f => (f?.issue || "").trim()).filter(Boolean);
    const faultCorrections = (a?.faults || []).map(f => (f?.correction || "").trim()).filter(Boolean);
    const issuesLine = issues.join(" - ");
    const correctionsBase = faultCorrections.length ? faultCorrections : (a?.corrections || []);
    const correctionsLine = (correctionsBase || []).join(" - ");
    return { issuesLine, correctionsLine };
  }
  const { issuesLine, correctionsLine } = faultsToLines(analysis);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Col 1: capture / upload */}
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle className="flex items-center gap-2">🎥 Import / Enregistrement</CardTitle></CardHeader>
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
              <label className="text-xs text-muted-foreground">Fichier chargé</label>
              {/* On n'affiche PAS la vidéo du client */}
              <div className="rounded-xl border p-2 text-xs text-muted-foreground flex items-center justify-between">
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
        <CardHeader><CardTitle className="flex items-center gap-2">🧠 Résumé IA</CardTitle></CardHeader>
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
                <Button className="h-8 px-3 text-xs" onClick={confirmPredicted} disabled={isAnalyzing}>
                  Confirmer « {predictedExercise || "exercice_inconnu"} »
                </Button>
                <Button className="h-8 px-3 text-xs" variant="secondary" onClick={openOverride} disabled={isAnalyzing}>
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
              <div className="flex items-center flex-wrap gap-2">
                <Badge variant="secondary">
                  Exercice : {confirmedExercise || analysis.exercise || "inconnu"}
                </Badge>
              </div>

              {analysis.overall?.trim() && (
                <p className="text-sm leading-relaxed">{analysis.overall.trim()}</p>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Muscles principalement sollicités</h4>
                {analysis.muscles?.length ? (
                  <p className="text-sm">{analysis.muscles.join(" - ")}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">— non détecté —</p>
                )}
              </div>

              {(issuesLine || correctionsLine) && (
                <div className="space-y-1">
                  {issuesLine && <p className="text-sm"><span className="font-medium">Erreur détectée :</span> {issuesLine}</p>}
                  {correctionsLine && <p className="text-sm"><span className="font-medium">Corrections :</span> {correctionsLine}</p>}
                </div>
              )}

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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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
        {/* Aperçu caméra temps réel (pas enregistré côté UI) */}
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
        const t = (duration * (i + 1)) / (nFrames + 1);
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
    img.onload = () => resolve(img as HTMLImageElement);
    img.onerror = () => reject(new Error("Impossible de charger l’image."));
    img.src = src;
  });
}

function EmptyState() {
  return (
    <div className="text-sm text-muted-foreground">
      Importe une vidéo puis lance l’analyse pour obtenir le résumé ici.
    </div>
  );
}
