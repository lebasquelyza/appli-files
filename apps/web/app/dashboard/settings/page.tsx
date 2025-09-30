"use client";

import { useEffect, useRef, useState } from "react";
import { Section } from "@/components/ui/Page";

/* ======================= Police responsive ======================= */
function useSettingsFontSize() {
  useEffect(() => {
    const fs = getComputedStyle(document.body).fontSize || "16px";
    const num = parseFloat(fs) || 16;
    const smaller = Math.max(11, Math.round(num - 4));
    document.documentElement.style.setProperty("--settings-fs", `${smaller}px`);
  }, []);
}

/* ======================= Styles boutons ======================= */
const btnGhost =
  "rounded-full border bg-white px-4 py-2 shadow-sm hover:bg-gray-50 active:scale-[0.99] transition";

/* ======================= Jours (menu) ======================= */
function DaysDropdown({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  const labelsFull = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const toggle = (d: number) =>
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);

  return (
    <div className="relative inline-block" ref={wrap}>
      <button
        type="button"
        className={`${btnGhost} inline-flex items-center`}
        onClick={() => setOpen((o) => !o)}
        style={{ fontSize: "var(--settings-fs)" }}
      >
        <span className="font-medium">Jours</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Sélection des jours"
          className="absolute z-50 mt-2 w-64 rounded-2xl border bg-white p-3 shadow-lg"
          style={{ fontSize: "var(--settings-fs)" }}
        >
          <ul className="space-y-2">
            {labelsFull.map((lbl, i) => {
              const d = i + 1;
              const checked = value.includes(d);
              return (
                <li key={d} className="flex items-center gap-3">
                  <input
                    id={`day-${d}`}
                    type="checkbox"
                    className="accent-current"
                    checked={checked}
                    onChange={() => toggle(d)}
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
              <button type="button" className={`${btnGhost} px-3 py-1`} onClick={() => setOpen(false)}>
                OK
              </button>
              <button type="button" className={`${btnGhost} px-3 py-1`} onClick={() => onChange([])}>
                Tout vider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================= Heure (menu) ======================= */
function TimeDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (time: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(value);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => setTemp(value), [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
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
    <div className="relative inline-block" ref={wrap}>
      <button
        type="button"
        className={`${btnGhost} inline-flex items-center`}
        onClick={() => setOpen((o) => !o)}
        style={{ fontSize: "var(--settings-fs)" }}
      >
        <span className="font-medium">Heure</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Sélection de l'heure"
          className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border bg-white p-3 shadow-lg"
          style={{ fontSize: "var(--settings-fs)" }}
        >
          <input
            type="time"
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            step={300}
            className="w-full rounded-[10px] border px-3 py-2"
            style={{ fontSize: "var(--settings-fs)" }}
          />
          <div className="mt-3 flex items-center justify-end pt-2 border-t">
            <button type="button" className={`${btnGhost} px-3 py-1`} onClick={apply}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================= Formulaire de rappel ======================= */
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
      if (!res.ok) throw new Error("Erreur");
      alert("Rappel enregistré ✅");
    } catch (e) {
      alert("Erreur d’enregistrement");
    }
  };

  return (
    <div className="card space-y-4" style={{ fontSize: "var(--settings-fs)" }}>
      <h3 className="font-semibold">Rappel planifié</h3>
      <p>Fuseau : {tz}</p>
      <div className="flex flex-wrap items-center gap-3">
        <DaysDropdown value={days} onChange={setDays} />
        <TimeDropdown value={time} onChange={setTime} />
      </div>
      <div className="flex items-center justify-end">
        <button type="button" className="btn-dash" onClick={save}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}

/* ======================= Modale Mentions légales ======================= */
function LegalModal() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // ESC pour fermer
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, []);

  // Bloque le scroll du body quand la modale est ouverte
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div>
      <button type="button" className={btnGhost} onClick={() => setOpen(true)}>
        Voir les mentions légales
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[100] bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Conteneur (centré desktop, bottom-sheet mobile) */}
          <div className="fixed inset-0 z-[101] flex sm:items-center items-end justify-center sm:p-4 p-0">
            <div
              ref={panelRef}
              className="
                w-full sm:max-w-3xl bg-white shadow-2xl
                sm:rounded-2xl sm:border sm:p-6 p-4
                sm:max-h-[85dvh] sm:h-auto
                h-[92dvh] max-h-[100svh]
                overflow-y-auto overscroll-contain
              "
              style={{
                fontSize: "var(--settings-fs)",
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y",
                paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Mentions légales et politique de cookies"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-base font-semibold">Mentions légales</h3>
                <button aria-label="Fermer" className={btnGhost} onClick={() => setOpen(false)}>
                  Fermer
                </button>
              </div>

              {/* --- CONTENU COURT À COMPLÉTER PLUS TARD --- */}
              <div className="mt-3 space-y-4 leading-relaxed">
                <p className="opacity-80">
                  Ici vos mentions légales (éditeur du site, hébergeur, propriété intellectuelle,
                  données personnelles, cookies, contact, etc.). Remplacez ce texte par votre contenu
                  lorsque vos informations seront prêtes.
                </p>

                <h4 className="font-semibold">Cookies</h4>
                <p className="opacity-80">
                  Ce site utilise des cookies nécessaires au bon fonctionnement et, le cas échéant,
                  pour la mesure d’audience. Vous pouvez gérer vos préférences ici :
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => {
                      alert("Ouvrir le gestionnaire de préférences cookies (à connecter à votre CMP).");
                    }}
                  >
                    Gérer mes préférences cookies
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => {
                      try {
                        const list = document.cookie?.split(";").map((c) => c.trim()).filter(Boolean);
                        const pretty =
                          list && list.length
                            ? list
                                .map((p) => {
                                  const i = p.indexOf("=");
                                  const name = i >= 0 ? p.slice(0, i) : p;
                                  const value = i >= 0 ? decodeURIComponent(p.slice(i + 1)) : "";
                                  return `${name} = ${value}`;
                                })
                                .join("\n")
                            : "Aucun cookie lisible côté client.";
                        alert(pretty);
                      } catch {
                        alert("Impossible de lire les cookies depuis ce contexte.");
                      }
                    }}
                  >
                    Voir les cookies actuels
                  </button>
                </div>

                <p className="text-xs opacity-60">Dernière mise à jour : 30/09/2025</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ======================= Préférences (type & valeurs) ======================= */
type Prefs = {
  language: "fr" | "en" | "de";
  theme: "light" | "dark" | "system";
  reducedMotion: boolean;
};
const LS_KEY = "app.prefs.v1";
const DEFAULT_PREFS: Prefs = { language: "fr", theme: "system", reducedMotion: false };

/* ======================= Page principale ======================= */
export default function Page() {
  useSettingsFontSize();

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

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
    root.setAttribute("lang", prefs.language);
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  }, [prefs, loaded]);

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div className="mb-2">
        <h1 className="h1" style={{ fontSize: 22, color: "#111827" }}>
          Réglages
        </h1>
      </div>

      <div style={{ fontSize: "var(--settings-fs)" }}>
        {/* ======================= Section Général ======================= */}
        <Section title="Général">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Langue */}
            <div className="card space-y-3">
              <h3 className="font-semibold">Langue</h3>
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
              <h3 className="font-semibold">Thème</h3>
              <div className="flex flex-wrap gap-2">
                {(["light", "dark", "system"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={btnGhost}
                    aria-pressed={prefs.theme === t}
                    onClick={() => setPrefs((p) => ({ ...p, theme: t }))}
                  >
                    {t === "light" ? "Clair" : t === "dark" ? "Sombre" : "Auto"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ======================= Section Notifications ======================= */}
        <Section title="Notifications push (beta)">
          <div className="card space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <button
                type="button"
                className={btnGhost}
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
                      return alert("Notifications refusées.");
                    }
                    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                    if (!vapid) return alert("NEXT_PUBLIC_VAPID_PUBLIC_KEY manquante.");
                    if (!("serviceWorker" in navigator)) return alert("SW non supporté.");
                    await navigator.serviceWorker.ready;

                    const { ensurePushSubscription, getDeviceId } = await import("@/lib/pushClient");
                    const sub = await ensurePushSubscription(vapid!);
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
                className={btnGhost}
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
                    const reg = await navigator.serviceWorker.ready;
                    const s = await reg.pushManager.getSubscription();
                    await s?.unsubscribe();
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
          </div>
        </Section>

        {/* ======================= Section Cookies & Mentions ======================= */}
        <Section title="Cookies & Mentions légales">
          <p className="opacity-70 mb-4">
            Consultez ici notre politique de cookies et les mentions légales du site.
          </p>
          <LegalModal />
        </Section>
      </div>
    </div>
  );
}
