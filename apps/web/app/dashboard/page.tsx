"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader, Section } from "@/components/ui/Page";

/** Applique la taille de police globale du site à la page Réglages (hérite du <body>) */
function useBodyFontSizeVar() {
  useEffect(() => {
    // Récupère la taille de police calculée du body (ex: 16px) — la même que sur “Bienvenue”
    const fs = getComputedStyle(document.body).fontSize || "16px";
    document.documentElement.style.setProperty("--app-body-fs", fs);
  }, []);
}

/** Bouton discret réutilisable (laisse hériter la taille de police) */
const btnGhostBase =
  "rounded-full border bg-white px-4 py-2 shadow-sm hover:bg-gray-50 active:scale-[0.99] transition";

/* =======================
   Menu déroulant des jours (bouton "Jours")
   ======================= */
function DaysDropdown({
  value,
  onChange,
}: {
  value: number[]; // 1..7 (Lu..Di)
  onChange: (days: number[]) => void;
}) {
  const labelsFull = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const toggleDay = (d: number) =>
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);

  return (
    <div className="relative inline-block" ref={wrapperRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${btnGhostBase} inline-flex items-center`}
        style={{ fontSize: "var(--app-body-fs, 16px)" }}
      >
        <span className="font-medium">Jours</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Sélection des jours"
          className="absolute z-50 mt-2 w-64 rounded-2xl border bg-white p-3 shadow-lg"
          style={{ fontSize: "var(--app-body-fs, 16px)" }}
        >
          <ul className="space-y-2">
            {labelsFull.map((lbl, i) => {
              const d = i + 1; // 1..7
              const checked = value.includes(d);
              return (
                <li key={d} className="flex items-center gap-3">
                  <input
                    id={`day-${d}`}
                    type="checkbox"
                    className="accent-current"
                    checked={checked}
                    onChange={() => toggleDay(d)}
                  />
                  <label htmlFor={`day-${d}`} className="cursor-pointer">
                    {lbl}
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex items-center justify-end pt-2 border-t">
            <div className="flex gap-2">
              <button type="button" className={`${btnGhostBase} px-3 py-1`}>
                OK
              </button>
              <button
                type="button"
                className={`${btnGhostBase} px-3 py-1`}
                onClick={() => onChange([])}
              >
                Tout vider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =======================
   Menu déroulant de l'heure (bouton "Heure")
   ======================= */
function TimeDropdown({
  value,
  onChange,
}: {
  value: string; // "HH:mm"
  onChange: (time: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(value);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setTemp(value), [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const apply = () => {
    onChange(temp || "08:00");
    setOpen(false);
  };

  return (
    <div className="relative inline-block" ref={wrapperRef}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${btnGhostBase} inline-flex items-center`}
        style={{ fontSize: "var(--app-body-fs, 16px)" }}
      >
        <span className="font-medium">Heure</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Sélection de l'heure"
          className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border bg-white p-3 shadow-lg"
          style={{ fontSize: "var(--app-body-fs, 16px)" }}
        >
          <div className="flex items-center gap-3">
            <input
              type="time"
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              step={300}
              className="w-full rounded-[10px] border px-3 py-2"
              style={{ fontSize: "var(--app-body-fs, 16px)" }}
            />
          </div>

          <div className="mt-3 flex items-center justify-end pt-2 border-t">
            <button type="button" className={`${btnGhostBase} px-3 py-1`} onClick={apply}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =======================
   Voir les cookies (discret)
   ======================= */
function CookiesViewer() {
  const [open, setOpen] = useState(false);
  const [cookies, setCookies] = useState<{ name: string; value: string }[]>([]);

  const load = () => {
    const list =
      document.cookie
        ?.split(";")
        .map((c) => c.trim())
        .filter(Boolean)
        .map((pair) => {
          const idx = pair.indexOf("=");
          const name = idx >= 0 ? pair.slice(0, idx) : pair;
          const value = idx >= 0 ? decodeURIComponent(pair.slice(idx + 1)) : "";
          return { name, value };
        }) ?? [];
    setCookies(list);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  return (
    <div className="card space-y-3" style={{ fontSize: "var(--app-body-fs, 16px)" }}>
      <button type="button" className={btnGhostBase} onClick={() => setOpen((o) => !o)}>
        {open ? "Masquer les cookies" : "Voir les cookies"}
      </button>

      {open && (
        <div className="rounded-xl border bg-white p-3">
          {cookies.length === 0 ? (
            <p className="opacity-70">Aucun cookie lisible côté client.</p>
          ) : (
            <ul className="space-y-2">
              {cookies.map((c) => (
                <li key={c.name} className="break-words">
                  <span className="font-medium">{c.name}</span>
                  <span className="opacity-60"> = </span>
                  <code className="rounded bg-gray-50 px-1 py-0.5">{c.value}</code>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <button type="button" className={btnGhostBase} onClick={load}>
              Actualiser
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================
   Formulaire de rappel planifié (jours + heure)
   ========================================== */
function PushScheduleForm() {
  const [time, setTime] = useState("08:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const save = async () => {
    try {
      const { getDeviceId } = await import("@/lib/pushClient");
      const deviceId = getDeviceId();
      const res = await fetch("/api/push/prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, time, days, tz }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return alert("Sauvegarde KO: " + (j.error ?? res.status));
      alert("Rappel enregistré ✅");
    } catch (e: any) {
      alert("Erreur: " + (e?.message || String(e)));
    }
  };

  return (
    <div className="card space-y-4" style={{ fontSize: "var(--app-body-fs, 16px)" }}>
      <h3 className="font-semibold">Rappel planifié</h3>
      <p style={{ color: "var(--muted)" }}>Fuseau : {tz}</p>

      <div className="flex flex-wrap items-center gap-3">
        <DaysDropdown value={days} onChange={setDays} />
        <TimeDropdown value={time} onChange={setTime} />
      </div>

      <div className="flex items-center justify-end">
        <button type="button" className="btn-dash" onClick={save}>
          Enregistrer le rappel
        </button>
      </div>
    </div>
  );
}

/* =======================
   Préférences visuelles (simplifiées)
   ======================= */
type Prefs = {
  language: "fr" | "en" | "de";
  theme: "light" | "dark" | "system";
  reducedMotion: boolean;
};

const LS_KEY = "app.prefs.v1";

const DEFAULT_PREFS: Prefs = {
  language: "fr",
  theme: "system",
  reducedMotion: false,
};

/* =======================
   Page Réglages
   ======================= */
export default function Page() {
  useBodyFontSizeVar(); // ← synchronise la taille de police avec celle du site (Bienvenue)

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const root = document.documentElement;
    const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const isDark = prefs.theme === "dark" || (prefs.theme === "system" && systemDark);
    root.classList.toggle("dark", isDark);
    root.setAttribute("data-theme", isDark ? "dark" : "light");
    root.style.setProperty("--reduce-motion", prefs.reducedMotion ? "1" : "0");
    document.body.style.animationDuration = prefs.reducedMotion ? "0s" : "";
    document.body.style.transitionDuration = prefs.reducedMotion ? "0s" : "";
    root.setAttribute("lang", prefs.language);
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
    setMsg("Réglages enregistrés ✅");
    const t = setTimeout(() => setMsg(null), 1200);
    return () => clearTimeout(t);
  }, [prefs, loaded]);

  // On met la taille une seule fois sur un wrapper : tout le contenu (hors gros titres) hérite
  return (
    <div style={{ fontSize: "var(--app-body-fs, 16px)" }}>
      {/* Titre (gros) garde sa propre taille via le composant */}
      <div className="mb-2">
        <PageHeader title="Réglages" />
      </div>

      {/* --- Section Général --- */}
      <Section title="Général">
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Langue */}
            <div className="card space-y-3">
              <div>
                <h3 className="font-semibold">Langue</h3>
              </div>
              <select
                className="rounded-[10px] border px-3 py-2 w-full"
                value={prefs.language}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, language: e.target.value as Prefs["language"] }))
                }
                disabled={!loaded}
              >
                <option value="fr">Français (FR)</option>
                <option value="en">English (EN)</option>
                <option value="de">Deutsch (DE)</option>
              </select>
            </div>

            {/* Thème */}
            <div className="card space-y-3">
              <div>
                <h3 className="font-semibold">Thème</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["light", "dark", "system"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={btnGhostBase}
                    aria-pressed={prefs.theme === t}
                    onClick={() => setPrefs((p) => ({ ...p, theme: t }))}
                  >
                    {t === "light" ? "Clair" : t === "dark" ? "Sombre" : "Auto"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* --- Section Notifications push (beta) --- */}
      <Section title="Notifications push (beta)">
        <div className="card space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              className={btnGhostBase}
              onClick={async () => {
                try {
                  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
                  const isStandalone =
                    window.matchMedia?.("(display-mode: standalone)").matches ||
                    (navigator as any).standalone === true;
                  if (isIOS && !isStandalone) {
                    alert("Sur iOS, ouvre l’app depuis l’icône écran d’accueil (PWA), pas Safari.");
                    return;
                  }
                  if ("Notification" in window && Notification.permission === "default") {
                    const p = await Notification.requestPermission();
                    if (p !== "granted") return alert("Notifications refusées.");
                  }
                  if ("Notification" in window && Notification.permission === "denied") {
                    return alert("Notifications refusées dans le navigateur / iOS.");
                  }
                  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                  if (!vapid) return alert("NEXT_PUBLIC_VAPID_PUBLIC_KEY manquante.");
                  if (!("serviceWorker" in navigator)) return alert("SW non supporté.");
                  const reg = await navigator.serviceWorker.ready.catch(() => null);
                  if (!reg) return alert("Service worker non prêt. Enregistre /sw.js au boot.");

                  const { ensurePushSubscription, getDeviceId } = await import("@/lib/pushClient");
                  const sub = await ensurePushSubscription(vapid);
                  const deviceId = getDeviceId();

                  const res = await fetch("/api/push/subscribe", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ deviceId, subscription: sub }),
                  });
                  const j = await res.json().catch(() => ({}));
                  if (!res.ok) return alert("Subscribe KO: " + res.status + " " + (j.error ?? ""));
                  alert("Notifications push activées ✅");
                } catch (e: any) {
                  alert("Erreur: " + (e?.message || String(e)));
                }
              }}
            >
              Activer les notifications
            </button>

            <button
              type="button"
              className={btnGhostBase}
              onClick={async () => {
                try {
                  const { getDeviceId } = await import("@/lib/pushClient");
                  const deviceId = getDeviceId();
                  const res = await fetch("/api/push/unsubscribe", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ deviceId }),
                  });
                  const j = await res.json().catch(() => ({}));
                  if (!res.ok) return alert("Unsubscribe KO: " + res.status + " " + (j.error ?? ""));
                  if ("serviceWorker" in navigator) {
                    const reg = await navigator.serviceWorker.ready.catch(() => null);
                    const s = await reg?.pushManager.getSubscription();
                    await s?.unsubscribe();
                  }
                  alert("Notifications push désactivées");
                } catch (e: any) {
                  alert("Erreur: " + (e?.message || String(e)));
                }
              }}
            >
              Désactiver
            </button>
          </div>

          <PushScheduleForm />
          <CookiesViewer />
        </div>
      </Section>
    </div>
  );
}
