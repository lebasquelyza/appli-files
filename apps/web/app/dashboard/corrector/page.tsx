"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
} from "react";
import { translations } from "@/app/i18n/translations";

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
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_PROXY_UPLOAD_MAX_BYTES
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

/* ========== Helpers UI (status) ========== */
function displayStatus(s: string) {
  if (!s) return s;
  const toMask = [
    "Fichier volumineux — upload signé…",
    "Proxy indisponible — upload signé…",
    "Upload de la vidéo…",
    "Préparation des images…",
    "Analyse IA…",
  ];
  if (toMask.some((p) => s.startsWith(p))) return "( Files examine... )";
  return s;
}

/* ========== i18n (client) ========== */
type Lang = "fr" | "en";

function getFromPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function getLangClient(): Lang {
  if (typeof document === "undefined") return "fr";
  const match = document.cookie.match(/(?:^|; )fc-lang=([^;]+)/);
  const val = match?.[1];
  if (val === "en") return "en";
  return "fr";
}

function useT() {
  const [lang, setLang] = useState<Lang>("fr");

  useEffect(() => {
    setLang(getLangClient());
  }, []);

  const t = useCallback(
    (path: string, fallback?: string) => {
      const dict = translations[lang] as any;
      const v = getFromPath(dict, path);
      if (typeof v === "string") return v;
      return fallback ?? path;
    },
    [lang]
  );

  return t;
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

/* ===== Lexiques FR / EN ===== */
const LEX_FR = {
  core: ["gainage", "sangle abdominale", "ceinture abdominale", "tronc"],
  braceVerb: ["gaine", "serre", "verrouille", "contracte", "stabilise"],
  neutralSpine: ["rachis neutre", "dos plat", "alignement lombaire neutre"],
  chestUp: ["poitrine fière", "sternum haut", "buste ouvert"],
  shoulderPack: [
    "épaules abaissées/serrées",
    "omoplates basses/rétractées",
    "pack scapulaire",
  ],
  avoidMomentum: [
    "évite l’élan",
    "pas d’à-coups",
    "contrôle le mouvement",
  ],
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
  wristNeutral: [
    "poignets neutres",
    "poignets alignés",
    "poignets pas cassés",
  ],
  headNeutral: [
    "regard neutre",
    "nuque longue",
    "évite l’hyperextension cervicale",
  ],
};

const LEX_EN = {
  core: ["core", "midline", "trunk"],
  braceVerb: ["brace", "lock", "tighten", "engage", "stabilize"],
  neutralSpine: ["neutral spine", "flat back", "neutral lumbar alignment"],
  chestUp: ["proud chest", "sternum up", "open chest"],
  shoulderPack: [
    "pack your shoulders",
    "scapulae down and back",
    "set your shoulder blades",
  ],
  avoidMomentum: ["avoid momentum", "no jerking", "stay smooth"],
  controlCue: ["controlled range", "own the movement", "smooth, steady reps"],
  rangeCue: ["useful range", "full pain-free range", "clean reps"],
  tempoIntro: ["Tempo", "Cadence", "Rhythm"],
  tempo201: ["2-0-1", "2s-0-1s"],
  tempo311: ["3-1-1", "3s-1-1s"],
  breathe: [
    "exhale on the effort",
    "breathe out on the concentric",
    "inhale on the way down",
  ],
  footTripod: [
    "tripod foot (heel + big/small toe)",
    "anchor your feet",
  ],
  kneeTrack: [
    "knees track over toes",
    "keep knees in line",
    "avoid valgus",
  ],
  hipBack: [
    "hips back",
    "strong hinge",
    "push your hips behind you",
  ],
  gluteCue: [
    "drive through the heel",
    "push the heel",
    "lead with the heel",
  ],
  holdTop: [
    "pause 1s at the top",
    "1s peak squeeze",
    "hold the contraction",
  ],
  grip: ["firm grip", "squeeze the bar", "locked wrists"],
  elbowPathPush: [
    "elbows ~45°",
    "elbows under the bar",
    "avoid excessive flare",
  ],
  elbowPathPull: [
    "elbows close",
    "drive elbows to the hips",
    "stay under shoulder line",
  ],
  latDepress: [
    "depress the shoulders",
    "set the lats",
    "pull shoulders down",
  ],
  scapRetract: [
    "retract the shoulder blades",
    "squeeze the scapulae",
    "shoulders back",
  ],
  wristNeutral: [
    "neutral wrists",
    "stacked wrists",
    "no wrist break",
  ],
  headNeutral: [
    "neutral gaze",
    "long neck",
    "avoid neck hyperextension",
  ],
};

function getLex(lang: Lang) {
  return lang === "en" ? LEX_EN : LEX_FR;
}

/* ===== Phrases style coach FR & EN ===== */
const COACH_OPENERS_FR = [
  "Sur ta prochaine série, pense à",
  "Globalement c’est pas mal, mais essaie de",
  "Pour rendre ton mouvement plus propre, essaie de",
  "Petit ajustement technique :",
  "Un point à surveiller :",
  "Si tu veux optimiser le geste, garde en tête de",
];

const COACH_ENDERS_FR = [
  "— ça va vraiment sécuriser ton mouvement.",
  "pour protéger tes articulations et gagner en force.",
  "et tu vas sentir la différence tout de suite.",
  "pour que le geste soit plus fluide et efficace.",
  "et tu seras plus stable sur les prochaines séries.",
  "tout en gardant une bonne marge de sécurité.",
];

const COACH_OPENERS_EN = [
  "On your next set, focus on",
  "Solid effort — now try to",
  "To clean up the rep, aim to",
  "Quick technical tweak:",
  "One point to watch:",
  "If you want a stronger, safer rep, remember to",
];

const COACH_ENDERS_EN = [
  "— this will make you feel much more stable.",
  "to protect your joints and build strength.",
  "and you’ll notice the difference right away.",
  "for a smoother, more efficient rep.",
  "so you can stay tight through the whole range.",
  "while keeping a strong safety margin.",
];

/* ===== Helpers “coach” ===== */
function varyTerms(s: string, lang: Lang = "fr") {
  if (!s) return s;

  const lex = getLex(lang);
  let out = s;

  // mini-variations FR + EN sans dénaturer le sens
  out = out.replace(/\bcore\b/gi, pick(lex.core));
  out = out.replace(/\btronc\b/gi, pick(LEX_FR.core));
  out = out.replace(/\bdos (plat|droit)\b/gi, pick(LEX_FR.neutralSpine));
  out = out.replace(/\bneutral spine\b/gi, pick(LEX_EN.neutralSpine));

  return out;
}

function coachifyCue(raw: string, lang: Lang = "fr") {
  const cue = raw.trim().replace(/^[–\-•\s]+/, "");
  if (!cue) return "";

  const openers = lang === "en" ? COACH_OPENERS_EN : COACH_OPENERS_FR;
  const enders = lang === "en" ? COACH_ENDERS_EN : COACH_ENDERS_FR;

  // 1 fois sur 3 : on laisse brut pour ne pas over-styliser
  if (randInt(3) === 0) return cue;

  const opener = pick(openers);
  const ender = randInt(2) === 0 ? "" : " " + pick(enders);

  const body = lang === "fr" ? cue.toLowerCase() : cue; // en EN on garde le casing

  return `${opener} ${body}${ender}`.replace(/\s+/g, " ").trim();
}

function styleOverall(base: string, faultCount: number, lang: Lang = "fr") {
  const clean = base.trim();
  if (!clean) return "";

  const introFR =
    faultCount > 0
      ? [
          "Globalement, ton mouvement est intéressant.",
          "Beau boulot sur l’effort, on affine maintenant les détails.",
          "Tu as déjà de bonnes bases, on va améliorer deux-trois points.",
        ]
      : [
          "Très bon mouvement dans l’ensemble 👌",
          "Franchement, c’est propre techniquement.",
          "Bonne exécution, on reste quand même attentif à la suite.",
        ];

  const outroFR = [
    "Continue de te filmer, ça aide énormément à progresser.",
    "Garde ces points en tête sur les prochaines séries.",
    "On garde cette qualité sur la suite de ta séance.",
  ];

  const introEN =
    faultCount > 0
      ? [
          "Overall, this is a solid base.",
          "Good effort — now we’ll refine the details.",
          "You’ve got good fundamentals; let’s clean up a few key points.",
        ]
      : [
          "Really clean execution overall 👌",
          "That looks technically solid.",
          "Good reps — keep the same standard going forward.",
        ];

  const outroEN = [
    "Keep filming your sets — it’s one of the fastest ways to improve.",
    "Carry these cues into your next few sets.",
    "Stick with this quality and you’ll progress quickly.",
  ];

  const intro = pick(lang === "en" ? introEN : introFR);
  const outro = pick(lang === "en" ? outroEN : outroFR);

  if (randInt(2) === 0) return varyTerms(clean, lang);

  return `${intro} ${varyTerms(clean, lang)} ${outro}`
    .replace(/\s+/g, " ")
    .trim();
}

/* ===================== Catégories d’exos ===================== */
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
  {
    rx: /(deadlift|soulev|hinge|rdl|romanian|good\s*morning|hip\s*hinge)/i,
    cat: "hinge",
  },
  {
    rx: /(hip\s*thrust|pont\s*de\s*hanches|glute\s*bridge)/i,
    cat: "hipthrust",
  },
  { rx: /(leg\s*curl|ischio|hamstring\s*curl)/i, cat: "ham_iso" },
  {
    rx: /(calf|mollet|élévation\s*mollets|standing\s*calf|seated\s*calf)/i,
    cat: "calf",
  },
  { rx: /(pull[-\s]?up|traction)/i, cat: "pull_vertical" },
  { rx: /(lat\s*pulldown|tirage\s*vertical)/i, cat: "pull_vertical" },
  {
    rx: /(row|tirage\s*horizontal|barbell\s*row|pendlay|cable\s*row|seated\s*row)/i,
    cat: "pull_horizontal",
  },
  {
    rx: /(chest\s*supported\s*row|row\s*appui\s*pector)/i,
    cat: "row_chest",
  },
  { rx: /(face\s*pull)/i, cat: "face_pull" },
  {
    rx: /(bench|développé\s*couché|décliné|incliné)/i,
    cat: "push_horizontal",
  },
  {
    rx: /(ohp|overhead|militaire|shoulder\s*press|arnold)/i,
    cat: "push_vertical",
  },
  { rx: /(push[-\s]?up|pompe)/i, cat: "pushup" },
  { rx: /(dip|dips)/i, cat: "dip" },
  { rx: /(fly|écarté|pec\s*deck)/i, cat: "fly" },
  {
    rx: /(lateral\s*raise|élévation\s*latérale)/i,
    cat: "lateral_raise",
  },
  {
    rx: /(front\s*raise|élévation\s*frontale)/i,
    cat: "front_raise",
  },
  { rx: /(rear\s*delt|oiseau|reverse\s*fly)/i, cat: "rear_delt" },
  { rx: /(curl|biceps)/i, cat: "biceps" },
  {
    rx: /(triceps|pushdown|extension\s*triceps|kickback|overhead\s*extension)/i,
    cat: "triceps",
  },
  {
    rx: /(plank|planche|side\s*plank|gainage\s*latéral|hollow)/i,
    cat: "core_plank",
  },
  { rx: /(pallof|anti[-\s]?rotation|carry\s*offset)/i, cat: "core_anti_rotation" },
  {
    rx: /(crunch|sit[-\s]?up|leg\s*raise|mountain\s*climber|russian\s*twist)/i,
    cat: "core_flexion",
  },
  { rx: /(farmer|carry)/i, cat: "carry" },
  { rx: /(sled|prowler|traîneau)/i, cat: "sled" },
];

function getCategory(exo: string): Category {
  const s = (exo || "").toLowerCase();
  for (const { rx, cat } of EXO_ALIASES) if (rx.test(s)) return cat;
  return "unknown";
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

function makeCorrections(exo: string, lang: Lang = "fr") {
  const cat = getCategory(exo);
  const lex = getLex(lang);
  const tips: string[] = [];

  const universalEN = [
    `Keep a ${pick(lex.neutralSpine)} with ${pick(lex.chestUp)}.`,
    `${pick(lex.breathe)}.`,
    `${pick(lex.wristNeutral)} and ${pick(lex.headNeutral)}.`,
  ];

  const universalFR = [
    `Garde un ${pick(LEX_FR.neutralSpine)} avec ${pick(LEX_FR.chestUp)}.`,
    `${pick(LEX_FR.breathe)}.`,
    `${pick(LEX_FR.wristNeutral)} et ${pick(LEX_FR.headNeutral)}.`,
  ];

  const upperStab =
    lang === "en"
      ? [`${pick(lex.shoulderPack)}.`, `${pick(lex.grip)}.`]
      : [`${pick(LEX_FR.shoulderPack)}.`, `${pick(LEX_FR.grip)}.`];

  const lowerStab =
    lang === "en"
      ? [`${pick(lex.footTripod)}.`, `${pick(lex.kneeTrack)}.`]
      : [`${pick(LEX_FR.footTripod)}.`, `${pick(LEX_FR.kneeTrack)}.`];

  const addTempo = () => {
    const intro = pick(lex.tempoIntro);
    const tempo = randInt(2) ? pick(lex.tempo201) : pick(lex.tempo311);
    tips.push(`${intro} ${tempo}.`);
  };

  switch (cat) {
    case "squat":
      if (lang === "en") {
        tips.push(
          `${pick(lex.kneeTrack)}.`,
          `${pick(lex.footTripod)}.`,
          `${pick(lex.chestUp)}; ${pick(lex.controlCue)}.`
        );
        addTempo();
      } else {
        tips.push(
          `${pick(LEX_FR.kneeTrack)}.`,
          `${pick(LEX_FR.footTripod)}.`,
          `${pick(LEX_FR.chestUp)}; ${pick(LEX_FR.controlCue)}.`
        );
        tips.push(`${pick(LEX_FR.tempoIntro)} ${pick(LEX_FR.tempo311)}.`);
      }
      break;

    case "hinge":
      if (lang === "en") {
        tips.push(
          `${pick(lex.hipBack)}; soft knees.`,
          `${pick(lex.neutralSpine)}; ${pick(lex.scapRetract)}.`
        );
        addTempo();
      } else {
        tips.push(
          `${pick(LEX_FR.hipBack)}; genoux souples.`,
          `${pick(LEX_FR.neutralSpine)}; ${pick(LEX_FR.scapRetract)}.`,
          `${pick(LEX_FR.tempoIntro)} ${pick(LEX_FR.tempo311)}.`
        );
      }
      break;

    case "push_vertical":
      if (lang === "en") {
        tips.push(
          `${pick(lex.elbowPathPush)}.`,
          `${pick(lex.core)} tight; glutes engaged.`,
          `${pick(lex.controlCue)}.`
        );
      } else {
        tips.push(
          `${pick(LEX_FR.elbowPathPush)}.`,
          `${pick(LEX_FR.core)} solide; fessiers contractés.`,
          `${pick(LEX_FR.controlCue)}.`
        );
      }
      break;

    default:
      if (lang === "en") {
        tips.push(
          `Control your range and keep a ${pick(lex.neutralSpine)}.`,
          `${pick(lex.braceVerb)} your ${pick(lex.core)}.`,
          `${pick(lex.avoidMomentum)}.`
        );
      } else {
        tips.push(
          `Contrôle l’amplitude et garde un ${pick(LEX_FR.neutralSpine)}.`,
          `${pick(LEX_FR.braceVerb)} ta ${pick(LEX_FR.core)}.`,
          `${pick(LEX_FR.avoidMomentum)}.`
        );
      }
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
    tips.push(...(lang === "en" ? universalEN : universalFR));
  }

  if (randInt(2) === 0) addTempo();

  return uniqueShuffle(tips);
}

/* ===================== Page ===================== */
export default function Page() {
  const t = useT();

  return (
    <div
      className="container"
      style={{
        paddingTop: 24,
        paddingBottom: 32,
        fontSize: "var(--settings-fs, 12px)",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <div className="page-header">
        <div>
          <h1
            className="h1"
            style={{
              fontSize: "clamp(20px, 2.2vw, 24px)",
              lineHeight: 1.15,
            }}
          >
            {t("videoCoach.page.title", "Import / Enregistrement")}
          </h1>
          <p
            className="lead"
            style={{
              fontSize: "clamp(12px, 1.6vw, 14px)",
              lineHeight: 1.35,
            }}
          >
            {t(
              "videoCoach.page.subtitle",
              "Filme ou importe ta vidéo, ajoute ton ressenti puis lance l’analyse IA."
            )}
          </p>
        </div>
      </div>

      <CoachAnalyzer />
    </div>
  );
}

/* ===================== Composant principal ===================== */
function CoachAnalyzer() {
  const t = useT();

  const [tab, setTab] = useState<"record" | "upload">("record");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [feeling, setFeeling] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [predictedExercise, setPredictedExercise] = useState<string | null>(
    null
  );
  const [showChoiceGate, setShowChoiceGate] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideName, setOverrideName] = useState("");
  const [confirmedExercise, setConfirmedExercise] = useState<string | null>(
    null
  );

  const [cooldown, setCooldown] = useState<number>(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(
      () => setCooldown((c) => (c > 0 ? c - 1 : 0)),
      1000
    );
    return () => clearInterval(id);
  }, [cooldown]);

  const handleUpload = (f: File) => {
    const url = URL.createObjectURL(f);
    setBlobUrl(url);
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
    const res = await fetch("/api/videos/proxy-upload", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      let detail = "";
      try {
        detail = JSON.parse(txt)?.error || txt;
      } catch {
        detail = txt;
      }
      const err = new Error(`proxy-upload: HTTP ${res.status} ${detail}`);
      (err as any).status = res.status;
      throw err;
    }
    const json = await res.json();
    return json.url as string;
  }

  async function uploadWithSignedUrl(
    f: File
  ): Promise<{ path: string; readUrl: string }> {
    const r = await fetch("/api/videos/sign-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: f.name }),
    });
    if (!r.ok)
      throw new Error(`sign-upload: HTTP ${r.status} ${await r.text()}`);
    const { signedUrl, path } = await r.json();

    const put = await fetch(signedUrl, {
      method: "PUT",
      headers: {
        "content-type": f.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: f,
    });
    if (!put.ok)
      throw new Error(
        `upload PUT failed: ${put.status} ${await put.text()}`
      );

    const r2 = await fetch("/api/storage/sign-read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, expiresIn: 60 * 60 }),
    });
    if (!r2.ok)
      throw new Error(`sign-read: HTTP ${r2.status} ${await r2.text()}`);
    const { url } = await r2.json();
    return { path, readUrl: url as string };
  }

  const onAnalyze = async (userExercise?: string) => {
    if (!file || isAnalyzing || cooldown > 0) return;

    setIsAnalyzing(true);
    setProgress(5);
    setStatus("Préparation des images…");
    setErrorMsg("");

    const lang = getLangClient(); // FR ou EN au moment du clic

    try {
      // 0) EXTRACTION — RAPIDE
      const { frames, timestamps } = await extractFramesFromFile(file, 8);
      if (!frames.length)
        throw new Error("Impossible d’extraire des images de la vidéo.");
      setProgress(12);

      // MOSAÏQUES légères
      const half = Math.ceil(frames.length / 2);
      const mosaic1 = await makeMosaic(
        frames.slice(0, half),
        3,
        2,
        960,
        540,
        0.5
      );
      const mosaic2 = await makeMosaic(
        frames.slice(half),
        3,
        2,
        960,
        540,
        0.5
      );
      const mosaics = [mosaic1, mosaic2];
      const midTime = timestamps[Math.floor(timestamps.length / 2)] || 0;

      setProgress(20);

      // 1) UPLOAD
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
        lang === "fr"
          ? `Tu reçois des mosaïques issues d’une VIDEO (pas une photo). ` +
            `Identifie l'exercice et détecte les ERREURS TECHNIQUES. ` +
            `Réponds en FRANÇAIS avec le ton d’un coach sportif bienveillant. ` +
            `Structure ta réponse ainsi : ` +
            `1) Un court retour global (1–3 phrases, mélange positif + points à corriger). ` +
            `2) Une liste de 3 à 6 défauts techniques concrets (champ "faults"). ` +
            `3) Pour chaque défaut, donne une correction courte, très actionnable. ` +
            `Varie ton vocabulaire et évite de répéter les mêmes formulations.`
          : `You receive mosaics extracted from a VIDEO (not a photo). ` +
            `Identify the exercise and detect TECHNICAL ERRORS. ` +
            `Reply in ENGLISH with the tone of a supportive strength coach. ` +
            `Structure your answer as: ` +
            `1) A short global feedback (1–3 sentences, mixing positives and corrections). ` +
            `2) A list of 3–6 concrete technical faults (field "faults"). ` +
            `3) For each fault, give a short, very actionable correction. ` +
            `Vary your wording and avoid repeating the same phrases.`;

      const overrideHint =
        userExercise && lang === "fr"
          ? `Exercice exécuté indiqué par l'utilisateur : "${userExercise}".`
          : userExercise && lang === "en"
          ? `Exercise performed as indicated by the user: "${userExercise}".`
          : "";

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

        if (res.status === 429 || res.status === 504) setCooldown(seconds);

        const txt = await res.text().catch(() => "");
        throw new Error(`analyze: HTTP ${res.status} ${txt}`);
      }

      const data: Partial<AIAnalysis> = await res.json();
      const rawFaults: Fault[] = Array.isArray((data as any).faults)
        ? ((data as any).faults as Fault[])
        : [];

      const safe: AIAnalysis = {
        exercise: String(data.exercise || "exercice_inconnu"),
        overall:
          (data.overall && data.overall.trim()) ||
          (lang === "fr"
            ? "Analyse effectuée mais je manque d’indices visuels. Réessaie avec un angle plus net / cadrage entier."
            : "Analysis completed but I’m missing clear visual cues. Try again with a clearer angle and full body in the frame."),
        muscles:
          Array.isArray(data.muscles) && data.muscles.length
            ? data.muscles.slice(0, 8)
            : [],
        corrections: Array.isArray((data as any).corrections)
          ? ((data as any).corrections as string[])
          : [],
        faults: rawFaults,
        extras: Array.isArray(data.extras) ? data.extras : [],
        timeline: Array.isArray(data.timeline)
          ? data.timeline.filter(
              (v) =>
                typeof v?.time === "number" && typeof v?.label === "string"
            )
          : [],
        objects: Array.isArray((data as any)?.objects)
          ? ((data as any).objects as string[])
          : [],
        movement_pattern:
          typeof (data as any)?.movement_pattern === "string"
            ? (data as any).movement_pattern
            : undefined,
        skeleton_cues: Array.isArray((data as any)?.skeleton_cues)
          ? ((data as any).skeleton_cues as AIAnalysis["skeleton_cues"])
          : [],
      };

      // Post-traitement “coach” bilingue
      safe.overall = styleOverall(safe.overall, rawFaults.length || 0, lang);
      safe.faults = (safe.faults || []).map((f) => ({
        ...f,
        issue: varyTerms(f.issue || "", lang),
        correction: varyTerms(f.correction || "", lang),
      }));

      const combinedCues = [
        ...makeCorrections(safe.exercise || "", lang),
        ...(safe.corrections || []),
      ].map((c) => varyTerms(c, lang));

      safe.corrections = uniqueShuffle(
        combinedCues.map((c) => coachifyCue(c, lang)).filter(Boolean)
      ).slice(0, 5);

      safe.muscles = (safe.muscles || []).map((m) => varyTerms(m, lang));

      // Gate de confirmation
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
      setStatus(
        t(
          "videoCoach.status.done",
          "Analyse terminée — confirme l’exercice"
        )
      );
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || String(e);
      setErrorMsg(msg);
      setStatus("");
      alert(
        `${t(
          "videoCoach.error.prefix",
          "Erreur pendant l'analyse"
        )}: ${msg}`
      );
    } finally {
      setIsAnalyzing(false);
    }
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
  const [muscleOpen, setMuscleOpen] = useState<string | null>(null);

  /* ======= PUB INTERSTITIELLE : état & déclenchement ======= */
  const [showAd, setShowAd] = useState(false);
  const pendingExerciseRef = useRef<string | undefined>(undefined);

  // Charger l'annonce quand l'overlay s'affiche
  useEffect(() => {
    if (!showAd) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn("Adsense error", e);
    }
  }, [showAd]);

  const startAnalyzeWithAd = (userExercise?: string) => {
    if (!file || isAnalyzing || cooldown > 0) return;
    pendingExerciseRef.current = userExercise;
    setShowAd(true);
  };

  const handleAdClose = async () => {
    const ex = pendingExerciseRef.current;
    pendingExerciseRef.current = undefined;
    setShowAd(false);
    await onAnalyze(ex);
  };

  /* ====== LAYOUT : 3 cartes alignées, même taille ====== */
  const gridStyle: CSSProperties = {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "1fr",
    alignItems: "stretch",
  };
  if (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(min-width: 1024px)").matches
  ) {
    (gridStyle as any).gridTemplateColumns = "repeat(3, 1fr)";
  }

  const cardStyle: CSSProperties = {
    height: "100%",
    display: "flex",
    flexDirection: "column",
  };

  return (
    <>
      <div style={gridStyle}>
        {/* 1. Import / Enregistrement */}
        <article className="card" style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>
            {t("videoCoach.card.import.title", "🎥 Import / Enregistrement")}
          </h3>

          {/* Onglets Filmer / Importer */}
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
              }}
            >
              {t("videoCoach.card.import.tabRecord", "Filmer")}
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
              }}
            >
              {t("videoCoach.card.import.tabUpload", "Importer")}
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
              <label className="label" style={{ marginBottom: 6 }}>
                {t(
                  "videoCoach.card.import.fileLabel",
                  "Fichier téléchargé"
                )}
              </label>

              <div
                className="card"
                style={{
                  padding: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t(
                      "videoCoach.card.import.fileName",
                      "🎞️ Vidéo importée"
                    )}
                  </span>
                </div>

                <button
                  className="btn"
                  onClick={reset}
                  type="button"
                  style={{
                    flexShrink: 0,
                    background: "#ffffff",
                    color: "#111827",
                    border: "1px solid #d1d5db",
                    fontWeight: 500,
                  }}
                >
                  {t("videoCoach.common.reset", "↺ Réinitialiser")}
                </button>
              </div>
            </div>
          )}
        </article>

        {/* 2. Ressenti */}
        <article className="card" style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>
            {t("videoCoach.card.feeling.title", "🎙️ Ton ressenti")}
          </h3>
          <label className="label">
            {t("videoCoach.card.feeling.label", "Comment tu te sens ?")}
          </label>
          <textarea
            className="input"
            placeholder={t(
              "videoCoach.card.feeling.placeholder",
              "Explique douleurs, fatigue, où tu as senti l'effort, RPE, etc."
            )}
            value={feeling}
            onChange={(e) => setFeeling(e.target.value)}
            style={{ minHeight: 140, flexGrow: 1 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              className="btn btn-dash"
              disabled={!blobUrl || isAnalyzing || cooldown > 0}
              onClick={() => startAnalyzeWithAd()}
              type="button"
            >
              {isAnalyzing ? <Spinner className="mr-2" /> : "✨"}{" "}
              {isAnalyzing
                ? t(
                    "videoCoach.card.feeling.btnAnalyzing",
                    "Analyse en cours"
                  )
                : cooldown > 0
                ? t("videoCoach.card.feeling.btnCooldown", "Patiente ") +
                  `${cooldown}s`
                : t(
                    "videoCoach.card.feeling.btnLaunch",
                    "Lancer l'analyse IA"
                  )}
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
              }}
              disabled={isAnalyzing}
            >
              {t("videoCoach.common.reset", "Réinitialiser")}
            </button>
          </div>

          {(isAnalyzing || progress > 0 || errorMsg || status) && (
            <div style={{ marginTop: 12 }}>
              <ProgressBar value={progress} />
              {status && (
                <p
                  className="text-xs"
                  style={{ color: "#6b7280", marginTop: 6 }}
                >
                  {displayStatus(status)}
                </p>
              )}
              {errorMsg && (
                <p
                  className="text-xs"
                  style={{ color: "#dc2626", marginTop: 6 }}
                >
                  {t("videoCoach.error.label", "Erreur")} : {errorMsg}
                </p>
              )}
            </div>
          )}
        </article>

        {/* 3. Résumé IA */}
        <article className="card" style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>
            {t("videoCoach.card.summary.title", "🧠 Résumé IA")}
          </h3>

          {!analysis && (
            <p className="text-sm" style={{ color: "#6b7280" }}>
              {t(
                "videoCoach.card.summary.empty",
                "Importe une vidéo puis lance l’analyse pour obtenir le résumé ici."
              )}
            </p>
          )}

          {/* GATE de confirmation */}
          {analysis && showChoiceGate && (
            <div style={{ display: "grid", gap: 8 }}>
              <div className="text-sm">
                {t(
                  "videoCoach.card.summary.gate.propose",
                  "L’IA propose"
                )}{" "}
                : <strong>{predictedExercise || "exercice_inconnu"}</strong>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn btn-dash"
                  onClick={confirmPredicted}
                  disabled={isAnalyzing}
                  type="button"
                >
                  {t(
                    "videoCoach.card.summary.gate.confirm",
                    "Confirmer"
                  )}{" "}
                  « {predictedExercise || "exercice_inconnu"} »
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
                  }}
                >
                  {t("videoCoach.card.summary.gate.other", "Autre")}
                </button>
              </div>

              {overrideOpen && (
                <div className="card" style={{ padding: 12 }}>
                  <label className="label">
                    {t(
                      "videoCoach.card.summary.override.label",
                      "Quel exercice fais-tu ?"
                    )}
                  </label>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      className="input"
                      placeholder={t(
                        "videoCoach.card.summary.override.placeholder",
                        "ex. Tractions, Fentes bulgares, Soulevé de terre…"
                      )}
                      value={overrideName}
                      onChange={(e) => setOverrideName(e.target.value)}
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
                      }}
                    >
                      {t(
                        "videoCoach.card.summary.override.reanalyze",
                        "Ré-analyser"
                      )}
                    </button>
                  </div>
                  <p
                    className="text-xs"
                    style={{ color: "#6b7280", marginTop: 6 }}
                  >
                    {t(
                      "videoCoach.card.summary.override.help",
                      "L’IA tiendra compte de ce nom pour corriger plus précisément."
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* RÉSULTATS */}
          {analysis && !showChoiceGate && (
            <div style={{ display: "grid", gap: 12 }}>
              <div className="text-sm">
                <span style={{ color: "#6b7280" }}>
                  {t(
                    "videoCoach.card.summary.exerciseLabel",
                    "Exercice"
                  )}{" "}
                  :
                </span>{" "}
                <strong>
                  {confirmedExercise ||
                    analysis.exercise ||
                    t("videoCoach.common.unknown", "inconnu")}
                </strong>
              </div>

              {analysis.overall?.trim() && (
                <p className="text-sm" style={{ lineHeight: 1.6 }}>
                  {analysis.overall.trim()}
                </p>
              )}

              <div>
                <h4
                  className="h4"
                  style={{ fontSize: 14, margin: "8px 0 4px" }}
                >
                  {t(
                    "videoCoach.card.summary.musclesTitle",
                    "Muscles principalement sollicités"
                  )}
                </h4>

                {analysis.muscles?.length ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    {analysis.muscles.map((m, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setMuscleOpen(m)}
                        title={t(
                          "videoCoach.card.summary.muscleBtnTitle",
                          "Voir l’emplacement"
                        )}
                        className="text-sm"
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: "1px solid #d1d5db",
                          background: "#ffffff",
                          color: "#111827",
                          cursor: "pointer",
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: "#6b7280" }}>
                    {t(
                      "videoCoach.card.summary.musclesEmpty",
                      "— non détecté —"
                    )}
                  </p>
                )}
              </div>

              {(issuesLine || correctionsLine) && (
                <div style={{ display: "grid", gap: 4 }}>
                  {issuesLine && (
                    <p className="text-sm">
                      <strong>
                        {t(
                          "videoCoach.card.summary.issuesLabel",
                          "Erreur détectée"
                        )}{" "}
                        :
                      </strong>{" "}
                      {issuesLine}
                    </p>
                  )}
                  {correctionsLine && (
                    <p className="text-sm">
                      <strong>
                        {t(
                          "videoCoach.card.summary.correctionsLabel",
                          "Corrections"
                        )}{" "}
                        :
                      </strong>{" "}
                      {correctionsLine}
                    </p>
                  )}
                </div>
              )}

              {analysis.extras && analysis.extras.length > 0 && (
                <details>
                  <summary style={{ cursor: "pointer" }}>
                    {t(
                      "videoCoach.card.summary.extrasSummary",
                      "Points complémentaires"
                    )}
                  </summary>
                  <ul
                    style={{ paddingLeft: 18, marginTop: 6 }}
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
      </div>

      {/* Panneau Muscle Viewer */}
      {muscleOpen && (
        <MuscleViewer
          muscleName={muscleOpen}
          onClose={() => setMuscleOpen(null)}
        />
      )}

      {/* ✅ OVERLAY PUB PLEIN ÉCRAN */}
      {showAd && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-[90vw] p-4">
            <p className="text-sm text-gray-700 mb-3 text-center">
              Cette analyse est financée par la publicité. Merci pour ton
              soutien 🙏
            </p>

            <div className="mb-3">
              <ins
                className="adsbygoogle"
                style={{ display: "block" }}
                data-ad-client="ca-pub-6468882840325295"
                data-ad-slot="1234567890" // ⬅️ REMPLACE ICI PAR TON VRAI SLOT
                data-ad-format="auto"
                data-full-width-responsive="true"
              />
            </div>

            <button
              type="button"
              onClick={handleAdClose}
              className="mt-2 w-full rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Continuer vers l’analyse
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ===================== Upload/Record ===================== */
function UploadDrop({ onFile }: { onFile: (file: File) => void }) {
  const t = useT();
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<HTMLInputElement | null>(null);

  const isIOS = () => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const isIThing = /iPad|iPhone|iPod/i.test(ua);
    const isTouchMac =
      navigator.platform === "MacIntel" &&
      (navigator as any).maxTouchPoints > 1;
    return isIThing || isTouchMac;
  };

  const openGalerie = () => {
    galleryRef.current?.click();
  };

  const openFichiers = async () => {
    const anyWindow = window as any;
    try {
      if (anyWindow?.showOpenFilePicker) {
        const [handle] = await anyWindow.showOpenFilePicker({
          multiple: false,
          excludeAcceptAllOption: false,
          types: [
            {
              description: "Vidéos",
              accept: {
                "video/*": [".mp4", ".mov", ".webm", ".mkv", ".avi"],
              },
            },
          ],
          startIn: "videos",
        });
        if (handle) {
          const f = await handle.getFile();
          if (f) onFile(f);
          return;
        }
      }
    } catch {
      /* annulé → fallback */
    }
    filesRef.current?.click();
  };

  return (
    <div
      className="card"
      style={{ padding: 16, display: "grid", gap: 10 }}
    >
      {isIOS() ? (
        <div className="grid gap-2 sm:flex sm:gap-3">
          <button
            type="button"
            className="btn"
            onClick={openGalerie}
            style={{
              background: "#ffffff",
              color: "#111827",
              border: "1px solid #d1d5db",
              fontWeight: 500,
            }}
          >
            {t("videoCoach.upload.import", "📥 Importer")}
          </button>
        </div>
      ) : (
        <div className="grid gap-2 sm:flex sm:gap-3">
          <button
            type="button"
            className="btn"
            onClick={openGalerie}
            style={{
              background: "#ffffff",
              color: "#111827",
              border: "1px solid #d1d5db",
              fontWeight: 500,
            }}
          >
            {t("videoCoach.upload.gallery", "📸 Galerie")}
          </button>
          <button
            type="button"
            className="btn"
            onClick={openFichiers}
            style={{
              background: "#ffffff",
              color: "#111827",
              border: "1px solid #d1d5db",
              fontWeight: 500,
            }}
          >
            {t("videoCoach.upload.files", "🗂️ Fichiers")}
          </button>
        </div>
      )}

      {/* Inputs cachés */}
      <input
        ref={galleryRef}
        type="file"
        accept="video/*"
        aria-hidden
        tabIndex={-1}
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && f.type.startsWith("video/")) onFile(f);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={filesRef}
        type="file"
        accept="video/*"
        aria-hidden
        tabIndex={-1}
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

function VideoRecorder({ onRecorded }: { onRecorded: (file: File) => void }) {
  const t = useT();
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await (videoRef.current as HTMLVideoElement).play();
        setHasStream(true);
      }
      const mr = new MediaRecorder(stream, {
        mimeType: getBestMimeType(),
        videoBitsPerSecond: 350_000,
      });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        const file = new File(
          [blob],
          `enregistrement-${Date.now()}.webm`,
          { type: blob.type }
        );
        onRecorded(file);
      };
      mr.start();
      setIsRecording(true);
    } catch (err) {
      alert(
        t(
          "videoCoach.videoRecorder.error.camera",
          "Impossible d'accéder à la caméra/micro. Vérifie les permissions."
        )
      );
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
        <video
          ref={videoRef}
          className="w-full rounded-2xl border"
          muted
          playsInline
        />
        {!hasStream && (
          <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
            {t(
              "videoCoach.videoRecorder.overlay",
              'Prépare ta caméra puis clique « Démarrer »'
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!isRecording ? (
          <button
            className="btn btn-dash"
            onClick={start}
            type="button"
          >
            {t("videoCoach.videoRecorder.start", "▶️ Démarrer")}
          </button>
        ) : (
          <button
            className="btn"
            onClick={stop}
            type="button"
            style={{
              background: "#ffffff",
              color: "#111827",
              border: "1px solid #d1d5db",
              fontWeight: 500,
            }}
          >
            {t("videoCoach.videoRecorder.stop", "⏸️ Arrêter")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ===== Helpers vidéo / images (optimisés) ===== */
function getBestMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    // @ts-ignore
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported &&
      MediaRecorder.isTypeSupported(c)
    )
      return c;
  }
  return "video/webm";
}
async function fakeProgress(
  setter: (v: number) => void,
  from: number,
  to: number
) {
  let i = from;
  while (i < to) {
    await new Promise((r) => setTimeout(r, 220));
    i += Math.floor(Math.random() * 10) + 3;
    setter(Math.min(i, to));
  }
}
async function extractFramesFromFile(
  file: File,
  nFrames = 8
): Promise<{ frames: string[]; timestamps: number[] }> {
  const videoURL = URL.createObjectURL(file);
  const video = document.createElement("video");
  (video as any).muted = true;
  (video as any).playsInline = true;
  video.src = videoURL;

  const TARGET_W = 480;
  const TARGET_H = 270;
  const JPEG_Q = 0.5;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () =>
        reject(new Error("Impossible de lire la vidéo côté client."));
    });

    const duration = Math.max(0.001, (video as any).duration || 0);
    const times: number[] = [];
    for (let i = 0; i < nFrames; i++) {
      const t = (duration * (i + 1)) / (nFrames + 1);
      times.push(t);
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;

    const frames: string[] = [];
    const timestamps: number[] = [];

    const drawFrame = async () => {
      try {
        const bmp = await createImageBitmap(video as any);
        ctx.drawImage(bmp as any, 0, 0, TARGET_W, TARGET_H);
        (bmp as any).close?.();
      } catch {
        ctx.drawImage(video as any, 0, 0, TARGET_W, TARGET_H);
      }
      frames.push(canvas.toDataURL("image/jpeg", JPEG_Q));
    };

    const hasRVFC =
      typeof (video as any).requestVideoFrameCallback === "function";

    for (const t of times) {
      if (hasRVFC) {
        (video as any).currentTime = Math.min(
          Math.max(0, t),
          (video as any).duration || t
        );
        await new Promise<void>((resolve) => {
          (video as any).requestVideoFrameCallback(async () => {
            await drawFrame();
            timestamps.push(Math.round(t));
            resolve();
          });
          setTimeout(async () => {
            // garde-fou
            await drawFrame();
            timestamps.push(Math.round(t));
            resolve();
          }, 300);
        });
      } else {
        await seek(video as any, t);
        await drawFrame();
        timestamps.push(Math.round(t));
      }
    }

    return { frames, timestamps };
  } finally {
    URL.revokeObjectURL(videoURL);
  }
}
function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Échec du seek vidéo."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    try {
      (video as any).currentTime = Math.min(
        Math.max(0, time),
        (video as any).duration || time
      );
    } catch {}
  });
}
function bestFit(w: number, h: number, maxW: number, maxH: number) {
  if (!w || !h) return { width: maxW, height: maxH };
  const r = Math.min(maxW / w, maxH / h);
  return { width: Math.round(w * r), height: Math.round(h * r) };
}
async function makeMosaic(
  images: string[],
  gridW = 3,
  gridH = 2,
  outW = 960,
  outH = 540,
  quality = 0.5
): Promise<string> {
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
    (ctx as any).drawImage(img as any, dx, dy, width, height);
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
function faultsToLines(a: AIAnalysis | null) {
  if (!a) return { issuesLine: "", correctionsLine: "" };
  const issues = (a?.faults || [])
    .map((f) => (f?.issue || "").trim())
    .filter(Boolean);
  const faultCorrections = (a?.faults || [])
    .map((f) => (f?.correction || "").trim())
    .filter(Boolean);
  const issuesLine = issues.join(" - ");
  const correctionsBase = faultCorrections.length
    ? faultCorrections
    : (a?.corrections || []);
  const correctionsLine = (correctionsBase || []).join(" - ");
  return { issuesLine, correctionsLine };
}

/* ===================== Muscle Viewer ===================== */
function normMuscle(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s\-’'".,]/g, "")
    .replace(/(le|la|les|du|de|des)/g, "")
    .replace(/muscle(s)?$/, "")
    .replace(/s$/, "");
}
const MUSCLE_MAP: Record<string, string[]> = {
  epaule: ["deltoid_l_f", "deltoid_r_f", "deltoid_l_b", "deltoid_r_b"],
  epaules: ["deltoid_l_f", "deltoid_r_f", "deltoid_l_b", "deltoid_r_b"],
  deltoide: ["deltoid_l_f", "deltoid_r_f", "deltoid_l_b", "deltoid_r_b"],
  deltoid: ["deltoid_l_f", "deltoid_r_f", "deltoid_l_b", "deltoid_r_b"],

  dorsal: ["lats_b"],
  dorsaux: ["lats_b"],
  granddorsal: ["lats_b"],
  lats: ["lats_b"],
  trapeze: ["traps_b"],
  trapezes: ["traps_b"],
  trapezius: ["traps_b"],

  pectoral: ["pecs_f"],
  pectoraux: ["pecs_f"],
  chest: ["pecs_f"],

  biceps: ["biceps_l_f", "biceps_r_f"],
  triceps: ["triceps_l_b", "triceps_r_b"],
  avantbras: ["forearm_l_f", "forearm_r_f"],
  forearm: ["forearm_l_f", "forearm_r_f"],

  abdominaux: ["abs_f"],
  abdos: ["abs_f"],
  oblique: ["obliques_l_f", "obliques_r_f"],
  obliques: ["obliques_l_f", "obliques_r_f"],

  fessier: ["glutes_b"],
  fessiers: ["glutes_b"],
  glute: ["glutes_b"],

  quadriceps: ["quads_l_f", "quads_r_f"],
  quadri: ["quads_l_f", "quads_r_f"],

  ischio: ["hams_l_b", "hams_r_b"],
  ischiojambier: ["hams_l_b", "hams_r_b"],
  hamstring: ["hams_l_b", "hams_r_b"],

  mollet: ["calf_l_b", "calf_r_b", "calf_l_f", "calf_r_f"],
  mollets: ["calf_l_b", "calf_r_b", "calf_l_f", "calf_r_f"],
  calves: ["calf_l_b", "calf_r_b", "calf_l_f", "calf_r_f"],
};

function MuscleViewer({
  muscleName,
  onClose,
}: {
  muscleName: string;
  onClose: () => void;
}) {
  const t = useT();
  const keys = MUSCLE_MAP[normMuscle(muscleName)] || [];
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center"
      style={{ background: "rgba(17,24,39,0.55)", padding: 16 }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 900, width: "100%", background: "#fff" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <h3 style={{ margin: 0 }}>📍 {muscleName}</h3>
          <button
            className="btn"
            onClick={onClose}
            style={{
              background: "#ffffff",
              color: "#111827",
              border: "1px solid #d1d5db",
              fontWeight: 500,
            }}
          >
            {t("videoCoach.muscleViewer.close", "Fermer")}
          </button>
        </div>

        <p className="text-xs" style={{ color: "#6b7280", marginTop: 6 }}>
          {t(
            "videoCoach.muscleViewer.subtitle",
            "Silhouette simplifiée — aucune zone cliquable, seules les zones sélectionnées sont mises en surbrillance."
          )}
        </p>

        <BodyMapHuman highlightKeys={keys} />
      </div>
    </div>
  );
}

/** Silhouette humaine (face/dos) grise, purement décorative : pointer-events désactivés. */
function BodyMapHuman({ highlightKeys }: { highlightKeys: string[] }) {
  const H = new Set(highlightKeys);
  const on = (id: string) => H.has(id);

  const show = (active: boolean) => ({
    display: active ? ("block" as const) : ("none" as const),
    fill: "#22c55e",
    opacity: 0.9,
    transition: "opacity .15s ease",
    pointerEvents: "none" as const,
  });

  const baseFill = "#d1d5db";
  const panelStyle: CSSProperties = {
    width: "100%",
    height: "auto",
    background: "#f9fafb",
    borderRadius: 12,
    padding: 8,
    pointerEvents: "none",
    userSelect: "none",
    cursor: "default",
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginTop: 12,
      }}
    >
      {/* FACE */}
      <svg
        viewBox="0 0 180 360"
        style={panelStyle}
        aria-label="silhouette face"
      >
        <path
          d="M90 18c-10 0-18 8-18 18v10c0 6 4 11 10 13l-2 6c-2 6-6 10-12 12-10 3-16 12-17 22-2 20-4 56 2 72 4 10 10 15 18 18 6 2 10 6 12 12 5 16 6 38 6 62h24c0-24 1-46 6-62 2-6 6-10 12-12 8-3 14-8 18-18 6-16 4-52 2-72-1-10-7-19-17-22-6-2-10-6-12-12l-2-6c6-2 10-7 10-13V36c0-10-8-18-18-18Z"
          fill={baseFill}
        />
        <path
          d="M66 270c-4 30-4 52-4 72h28v-50c0-8-4-16-10-22-4-4-10-0-14 0z"
          fill={baseFill}
        />
        <path
          d="M114 270c4 30 4 52 4 72H90v-50c0-8 4-16 10-22 4-4 10-0 14 0z"
          fill={baseFill}
        />
        <path
          d="M32 140c-2 26 2 44 10 54 6 8 14 12 22 14l6-20c-8-2-14-6-18-12-6-8-10-20-10-36l-10 0z"
          fill={baseFill}
        />
        <path
          d="M148 140c2 26-2 44-10 54-6 8-14 12-22 14l-6-20c8-2 14-6 18-12 6-8 10-20 10-36l10 0z"
          fill={baseFill}
        />

        {/* SURBRILLANCE */}
        <rect
          id="pecs_f"
          x="58"
          y="64"
          width="64"
          height="22"
          rx="8"
          style={show(on("pecs_f"))}
        />
        <circle
          id="deltoid_l_f"
          cx="46"
          cy="72"
          r="14"
          style={show(on("deltoid_l_f"))}
        />
        <circle
          id="deltoid_r_f"
          cx="134"
          cy="72"
          r="14"
          style={show(on("deltoid_r_f"))}
        />
        <rect
          id="biceps_l_f"
          x="28"
          y="94"
          width="16"
          height="38"
          rx="8"
          style={show(on("biceps_l_f"))}
        />
        <rect
          id="biceps_r_f"
          x="136"
          y="94"
          width="16"
          height="38"
          rx="8"
          style={show(on("biceps_r_f"))}
        />
        <rect
          id="forearm_l_f"
          x="28"
          y="134"
          width="16"
          height="36"
          rx="8"
          style={show(on("forearm_l_f"))}
        />
        <rect
          id="forearm_r_f"
          x="136"
          y="134"
          width="16"
          height="36"
          rx="8"
          style={show(on("forearm_r_f"))}
        />
        <rect
          id="abs_f"
          x="70"
          y="92"
          width="40"
          height="40"
          rx="8"
          style={show(on("abs_f"))}
        />
        <rect
          id="obliques_l_f"
          x="60"
          y="96"
          width="12"
          height="36"
          rx="6"
          style={show(on("obliques_l_f"))}
        />
        <rect
          id="obliques_r_f"
          x="108"
          y="96"
          width="12"
          height="36"
          rx="6"
          style={show(on("obliques_r_f"))}
        />
        <rect
          id="quads_l_f"
          x="64"
          y="152"
          width="18"
          height="52"
          rx="9"
          style={show(on("quads_l_f"))}
        />
        <rect
          id="quads_r_f"
          x="98"
          y="152"
          width="18"
          height="52"
          rx="9"
          style={show(on("quads_r_f"))}
        />
        <rect
          id="calf_l_f"
          x="64"
          y="214"
          width="18"
          height="42"
          rx="9"
          style={show(on("calf_l_f"))}
        />
        <rect
          id="calf_r_f"
          x="98"
          y="214"
          width="18"
          height="42"
          rx="9"
          style={show(on("calf_r_f"))}
        />
      </svg>

      {/* DOS */}
      <svg
        viewBox="0 0 180 360"
        style={panelStyle}
        aria-label="silhouette dos"
      >
        <path
          d="M90 18c-10 0-18 8-18 18v10c0 6 4 11 10 13l-1 5c-2 8-7 13-13 16-10 3-16 12-17 22-2 18-4 54 2 70 4 10 10 15 18 18 6 2 10 6 12 12 5 16 6 38 6 62h24c0-24 1-46 6-62 2-6 6-10 12-12 8-3 14-8 18-18 6-16 4-52 2-70-1-10-7-19-17-22-6-2-11-8-13-16l-1-5c6-2 10-7 10-13V36c0-10-8-18-18-18Z"
          fill={baseFill}
        />
        <path
          d="M66 270c-4 30-4 52-4 72h28v-50c0-8-4-16-10-22-4-4-10-0-14 0z"
          fill={baseFill}
        />
        <path
          d="M114 270c4 30 4 52 4 72H90v-50c0-8 4-16 10-22 4-4 10-0 14 0z"
          fill={baseFill}
        />
        <path
          d="M32 140c-2 26 2 44 10 54 6 8 14 12 22 14l6-20c-8-2-14-6-18-12-6-8-10-20-10-36l-10 0z"
          fill={baseFill}
        />
        <path
          d="M148 140c2 26-2 44-10 54-6 8-14 12-22 14l-6-20c8-2 14-6 18-12 6-8 10-20 10-36l10 0z"
          fill={baseFill}
        />

        <polygon
          id="traps_b"
          points="90,46 60,66 120,66"
          style={show(on("traps_b"))}
        />
        <rect
          id="lats_b"
          x="56"
          y="70"
          width="68"
          height="30"
          rx="10"
          style={show(on("lats_b"))}
        />
        <circle
          id="deltoid_l_b"
          cx="46"
          cy="72"
          r="14"
          style={show(on("deltoid_l_b"))}
        />
        <circle
          id="deltoid_r_b"
          cx="134"
          cy="72"
          r="14"
          style={show(on("deltoid_r_b"))}
        />
        <rect
          id="triceps_l_b"
          x="28"
          y="94"
          width="16"
          height="38"
          rx="8"
          style={show(on("triceps_l_b"))}
        />
        <rect
          id="triceps_r_b"
          x="136"
          y="94"
          width="16"
          height="38"
          rx="8"
          style={show(on("triceps_r_b"))}
        />
        <rect
          id="glutes_b"
          x="66"
          y="122"
          width="48"
          height="28"
          rx="10"
          style={show(on("glutes_b"))}
        />
        <rect
          id="hams_l_b"
          x="64"
          y="152"
          width="18"
          height="52"
          rx="9"
          style={show(on("hams_l_b"))}
        />
        <rect
          id="hams_r_b"
          x="98"
          y="152"
          width="18"
          height="52"
          rx="9"
          style={show(on("hams_r_b"))}
        />
        <rect
          id="calf_l_b"
          x="64"
          y="214"
          width="18"
          height="42"
          rx="9"
          style={show(on("calf_l_b"))}
        />
        <rect
          id="calf_r_b"
          x="98"
          y="214"
          width="18"
          height="42"
          rx="9"
          style={show(on("calf_r_b"))}
        />
      </svg>
    </div>
  );
}
