"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader, Section } from "@/components/ui/Page";

/* =======================
   Menu déroulant des jours
   ======================= */
function DaysDropdown({
  value,
  onChange,
}: {
  value: number[]; // 1..7 (Lu..Di)
  onChange: (days: number[]) => void;
}) {
  const labels = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Fermer en cliquant hors du menu
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const toggleDay = (d: number) =>
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);

  const summary =
    value.length === 0
      ? "Aucun jour"
      : value
          .slice()
          .sort((a, b) => a - b)
          .map((d) => labels[d - 1])
          .join(", ");

  return (
    <div className="relative inline-block" ref={wrapperRef}>
      <button
        type="button"
        className="btn-dash min-w-56 justify-between flex items-center gap-2"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>Jours</span>
        <span className="truncate opacity-70">{summary}</span>
        <svg
          aria-hidden
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11l3.71-3.77a.75.75 0 1 1 1.08 1.04l-4.25 4.32a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Sélection des jours"
          className="absolute z-50 mt-2 w-64 rounded-2xl border bg-white p-3 shadow-lg"
        >
          <ul className="space-y-2">
            {labels.map((lbl, i) => {
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
                  <label htmlFor={`day-${d}`} className="text-sm cursor-pointer">
                    {lbl} {i < 5 ? "(semaine)" : "(week-end)"}
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex items-center justify-between pt-2 border-t">
            <button
              type="button"
              className="text-xs underline"
              onClick={() => onChange([1, 2, 3, 4, 5])}
            >
              Lun → Ven
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn-dash" onClick={() => setOpen(false)}>
                OK
              </button>
              <button type="button" className="btn-dash" onClick={() => onChange([])}>
                Tout vider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================
   Formulaire de rappel planifié (heure + jours)
   ========================================== */
function PushScheduleForm() {
  const [time, setTime] = useState("08:00"); // HH:mm
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
      if (!res.ok) {
        alert("Sauvegarde KO: " + (j.error ?? res.status));
        return;
      }
      alert("Rappel enregistré ✅");
    } catch (e: any) {
      alert("Erreur: " + (e?.message || String(e)));
    }
  };

  return (
    <div className="card space-y-4">
      <div className="space-y-1">
        <h3 className="font-semibold">Rappel planifié</h3>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Choisis l’heure et les jours (heure locale : {tz}).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm" style={{ color: "var(--muted)" }}>
          Heure
        </label>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-[10px] border px-3 py-2 text-sm"
        />

        {/* Menu déroulant pour les jours */}
        <DaysDropdown value={days} onChange={setDays} />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          Le rappel sera envoyé aux jours sélectionnés à {time}.
        </div>
        <button type="button" className="btn-dash" onClick={save}>
          Enregistrer le rappel
        </button>
      </div>
    </div>
  );
}

/* =======================
   Préférences visuelles
   ======================= */
type Prefs = {
  language: "fr" | "en" | "de";
  theme: "light" | "dark" | "system";
  dateFormat: "dd/mm/yyyy" | "mm/dd/yyyy";
  timeFormat: "24h" | "12h";
  reducedMotion: boolean;
};

const LS_KEY = "app.prefs.v1";

const DEFAULT_PREFS: Prefs = {
  language: "fr",
  theme: "system",
  dateFormat: "dd/mm/yyyy",
  timeFormat: "24h",
  reducedMotion: false,
};

/* =======================
   Page Réglages
   ======================= */
export default function Page() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Charger depuis localStorage au mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
    setLoaded(true);
  }, []);

  // Appliquer thème & co
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

  const sampleDate = useMemo(() => {
    const d = new Date(2025, 8, 14, 16, 7);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh24 = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const hh12n = d.getHours() % 12 || 12;
    const ampm = d.getHours() < 12 ? "AM" : "PM";
    const date =
      prefs.dateFormat === "dd/mm/yyyy" ? `${dd}/${mm}/${yyyy}` : `${mm}/${dd}/${yyyy}`;
    const time = prefs.timeFormat === "24h" ? `${hh24}:${min}` : `${hh12n}:${min} ${ampm}`;
    return `${date} · ${time}`;
  }, [prefs.dateFormat, prefs.timeFormat]);

  return (
    <>
      <PageHeader title="Réglages" subtitle="Préférences de l’application" />

      {/* --- Section Général --- */}
      <Section title="Général">
        <div className="space-y-6">
          <div className="card">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Configure la langue, le thème, et le format date/heure. Les changements
              sont appliqués immédiatement et mémorisés sur cet appareil.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Langue */}
            <div className="card space-y-3">
              <div className="space-y-1">
                <h3 className="font-semibold">Langue</h3>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Choisis la langue par défaut de l’interface (local à cet appareil).
                </p>
              </div>
              <select
                className="rounded-[10px] border px-3 py-2 text-sm w-full"
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
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                (Astuce) Un futur i18n pourra surcharger ce choix.
              </p>
            </div>

            {/* Thème */}
            <div className="card space-y-3">
              <div className="space-y-1">
                <h3 className="font-semibold">Thème</h3>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Clair, sombre ou automatique selon ton système.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["light", "dark", "system"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="btn-dash"
                    aria-pressed={prefs.theme === t}
                    onClick={() => setPrefs((p) => ({ ...p, theme: t }))}
                  >
                    {t === "light" ? "Clair" : t === "dark" ? "Sombre" : "Auto"}
                  </button>
                ))}
              </div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                Aperçu instantané. Si tu utilises Tailwind, les classes <code>dark:</code> suivent.
              </div>
            </div>

         

            {/* Accessibilité */}
            <div className="card space-y-3">
              <div className="space-y-1">
                <h3 className="font-semibold">Accessibilité</h3>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Options d’ergonomie et de confort visuel.
                </p>
              </div>

              <label className="inline-flex items-center gap-3">
                <input
                  type="checkbox"
                  className="accent-current"
                  checked={prefs.reducedMotion}
                  onChange={(e) =>
                    setPrefs((p) => ({ ...p, reducedMotion: e.target.checked }))
                  }
                  disabled={!loaded}
                />
                <span>Réduire les animations</span>
              </label>

              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Désactive ou raccourcit certaines animations/transitions.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="card flex items-center justify-between gap-4">
            <button
              type="button"
              className="btn-dash"
              onClick={() => {
                setPrefs(DEFAULT_PREFS);
                setMsg("Réglages réinitialisés");
                setTimeout(() => setMsg(null), 1200);
              }}
              disabled={!loaded}
            >
              Réinitialiser
            </button>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              {msg ?? "Les changements sont enregistrés automatiquement"}
            </div>
          </div>
        </div>
      </Section>

      {/* --- Section Push (beta) --- */}
      <Section title="Notifications push (beta)">
        <div className="card space-y-3">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Fonctionnent même si l’app est fermée. Autorise les notifications puis active
            la souscription sur cet appareil.
          </p>

          <div className="flex flex-wrap gap-8 items-center">
            {/* ACTIVER */}
            <button
              type="button"
              className="btn-dash"
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
              Activer sur cet appareil
            </button>

            {/* DÉSACTIVER */}
            <button
              type="button"
              className="btn-dash"
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

            {/* ENVOYER UN TEST */}
            <button
              type="button"
              className="btn-dash"
              onClick={async () => {
                try {
                  const { getDeviceId } = await import("@/lib/pushClient");
                  const deviceId = getDeviceId();
                  const res = await fetch("/api/push/test", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      deviceId,
                      payload: {
                        title: "Files Coaching",
                        body: "Test push : prêt·e pour 10 min ? 💪",
                        url: "/dashboard",
                      },
                    }),
                  });
                  const j = await res.json().catch(() => ({}));
                  if (!res.ok) return alert(`Test KO: ${res.status} ${j.error ?? ""}`);
                  alert("Notification test envoyée ✅\n(Mets l’app en arrière-plan pour la voir)");
                } catch (e: any) {
                  alert("Erreur: " + (e?.message || String(e)));
                }
              }}
            >
              Envoyer un test
            </button>
          </div>

          {/* --- Formulaire de planification (avec menu déroulant) --- */}
          <PushScheduleForm />

          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Si rien ne s’affiche : vérifie que le navigateur autorise les notifications, que
            <code> NEXT_PUBLIC_VAPID_PUBLIC_KEY </code> est bien configurée et que le service worker est actif.
          </p>
        </div>
      </Section>

      {/* CTA */}
      <div className="card flex items-center justify-between gap-4">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Tu veux être notifié·e quand ces options arrivent ?
        </p>
        <button type="button" className="btn-dash">Me prévenir</button>
      </div>
    </>
  );
}
