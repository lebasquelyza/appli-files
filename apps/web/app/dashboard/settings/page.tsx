"use client";

import { useEffect, useRef, useState } from "react";
import { Section } from "@/components/ui/Page";

/* ======================= Taille de police ======================= */
function useSettingsFontSize() {
  useEffect(() => {
    const fs = getComputedStyle(document.body).fontSize || "16px";
    const num = parseFloat(fs) || 16;
    const smaller = Math.max(11, Math.round(num - 4));
    document.documentElement.style.setProperty("--settings-fs", `${smaller}px`);
  }, []);
}

/* ======================= Bouton générique ======================= */
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
              <button
                type="button"
                className={`${btnGhost} px-3 py-1`}
                onClick={() => setOpen(false)}
              >
                OK
              </button>
              <button
                type="button"
                className={`${btnGhost} px-3 py-1`}
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

/* ======================= Mentions légales ======================= */
function LegalModal() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        className={btnGhost}
        onClick={() => setOpen(true)}
        style={{ fontSize: "var(--settings-fs)" }}
      >
        Ouvrir les mentions légales
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            style={{
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
              fontSize: "var(--settings-fs)",
            }}
          >
            <h3 className="text-xl font-semibold mb-4">Mentions légales</h3>
            <p className="opacity-80 mb-4">
              (Ici ton texte complet — éditeur, hébergeur, propriété intellectuelle, cookies, etc.)
            </p>
            <button className={btnGhost} onClick={() => setOpen(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================= Formulaire rappel ======================= */
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

/* ======================= Page principale ======================= */
type Prefs = {
  language: "fr" | "en" | "de";
  theme: "light" | "dark" | "system";
  reducedMotion: boolean;
};
const LS_KEY = "app.prefs.v1";
const DEFAULT_PREFS: Prefs = { language: "fr", theme: "system", reducedMotion: false };

export default function Page() {
  useSettingsFontSize();

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    setLoaded(true);
  }, []);

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <h1 className="h1 mb-2" style={{ fontSize: 22 }}>
        Réglages
      </h1>

      <div style={{ fontSize: "var(--settings-fs)" }}>
        <Section title="Général">
          {/* Langue + thème ici */}
        </Section>

        <Section title="Notifications push (beta)">
          <PushScheduleForm />
        </Section>

        {/* ✅ Nouvelle section tout en bas */}
        <Section title="Cookies & Mentions légales">
          <p className="opacity-70 mb-2">
            Consultez ici notre politique de cookies et les mentions légales du site.
          </p>
          <LegalModal />
        </Section>
      </div>
    </div>
  );
}
