"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Section } from "@/components/ui/Page";
import { getSupabase } from "@/lib/supabaseClient";

/* ======================= Police responsive ======================= */
function useSettingsFontSize() {
  useEffect(() => {
    const fs = getComputedStyle(document.body).fontSize || "16px";
    const num = parseFloat(fs) || 16;
    const smaller = Math.max(11, Math.round(num - 4));
    document.documentElement.style.setProperty("--settings-fs", `${smaller}px`);
  }, []);
}

/* ======================= Helpers thème ======================= */
function applyThemeToRoot(isDark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.setAttribute("data-theme", isDark ? "dark" : "light");
}
function getSystemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}

/* ======================= Styles boutons ======================= */
const btnGhost =
  "rounded-full border px-4 py-2 shadow-sm transition active:scale-[0.99] " +
  "bg-white text-slate-900 border-slate-200 hover:bg-gray-50 " +
  "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-800";

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
          className="absolute z-50 mt-2 w-64 rounded-2xl border bg-white p-3 shadow-lg dark:bg-slate-900 dark:border-slate-700"
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

          <div className="mt-3 flex items-center justify-end pt-2 border-t dark:border-slate-700">
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
          className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border bg-white p-3 shadow-lg dark:bg-slate-900 dark:border-slate-700"
          style={{ fontSize: "var(--settings-fs)" }}
        >
          <input
            type="time"
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            step={300}
            className="w-full rounded-[10px] border px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
            style={{ fontSize: "var(--settings-fs)" }}
          />
          <div className="mt-3 flex items-center justify-end pt-2 border-t dark:border-slate-700">
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

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, []);

  return (
    <div>
      <button type="button" className={btnGhost} onClick={() => setOpen(true)}>
        Voir les mentions légales
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <div className="fixed inset-0 z-[101] flex sm:items-center items-end justify-center sm:p-4 p-0">
            <div
              ref={panelRef}
              className="
                w-full sm:max-w-3xl bg-white shadow-2xl
                sm:rounded-2xl sm:border sm:p-6 p-4
                sm:max-h-[85dvh] sm:h-auto
                h-[92dvh] max-h-[100svh]
                overflow-y-auto overscroll-contain
                dark:bg-slate-900 dark:border-slate-700
              "
              style={{ fontSize: "var(--settings-fs)", WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
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

              <div className="mt-3 space-y-4 leading-relaxed">
                <p className="opacity-80">
                  Ici vos mentions légales (éditeur du site, hébergeur, propriété intellectuelle,
                  données personnelles, cookies, contact, etc.). Remplacez ce texte par votre contenu
                  lorsque vos informations seront prêtes.
                </p>

                <h4 className="font-semibold">Cookies</h4>
                <p className="opacity-80">
                  Ce site utilise des cookies nécessaires au bon fonctionnement et, le cas échéant,
                  pour la mesure d’audience.
                </p>
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

/* ======================= Composant suppression de compte ======================= */
function DeleteAccountCard() {
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const REASONS = [
    { value: "no_longer_needed", label: "Je n’en ai plus besoin" },
    { value: "missing_features", label: "Il manque des fonctionnalités" },
    { value: "too_expensive", label: "Trop cher / pas rentable" },
    { value: "privacy_concerns", label: "Inquiétudes liées aux données" },
    { value: "bugs_or_quality", label: "Bugs / qualité insatisfaisante" },
    { value: "other", label: "Autre…" },
  ] as const;

  const [reason, setReason] = useState<string>("");
  const [reasonText, setReasonText] = useState("");

  const handleDelete = async () => {
    const supabase = getSupabase();
    setLoading(true);
    try {
      const { data: { session } = {} } = await supabase.auth.getSession();
      if (!session) {
        alert("Veuillez vous reconnecter avant de supprimer votre compte.");
        return;
      }

      const payload = {
        reason: reason || null,
        reasonText: reason === "other" ? (reasonText.trim() || null) : null,
      };

      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Erreur lors de la suppression");
      }
      alert("Votre compte a été supprimé. Au revoir 👋");
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e: any) {
      alert(e?.message || "Impossible de supprimer le compte");
    } finally {
      setLoading(false);
    }
  };

  const canDelete = confirm === "SUPPRIMER" && !loading;

  return (
    <div className="card space-y-4">
      <h3 className="font-semibold text-red-600 dark:text-red-400">Supprimer mon compte</h3>

      <div className="space-y-2">
        <label className="font-medium">Pourquoi partez-vous ? (facultatif)</label>
        <div className="grid sm:grid-cols-2 gap-2">
          {REASONS.map((r) => (
            <label
              key={r.value}
              className="flex items-center gap-2 rounded-[10px] border px-3 py-2 dark:bg-slate-900 dark:border-slate-700 cursor-pointer"
            >
              <input
                type="radio"
                name="delete-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={(e) => setReason(e.target.value)}
                className="accent-current"
              />
              <span>{r.label}</span>
            </label>
          ))}
        </div>

        {reason === "other" && (
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            rows={3}
            placeholder="Dites-nous en plus (optionnel)"
            className="mt-2 w-full rounded-[10px] border px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
          />
        )}
      </div>

      <p className="opacity-80">
        Cette action est <strong>irréversible</strong> : vos données et accès seront supprimés.
        Pour confirmer, tapez{" "}
        <code className="px-1 py-0.5 rounded bg-red-50 dark:bg-red-900/30">SUPPRIMER</code> :
      </p>
      <input
        type="text"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="SUPPRIMER"
        className="w-full rounded-[10px] border px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
        aria-label="Champ de confirmation de suppression"
      />
      <div className="flex items-center justify-end">
        <button
          type="button"
          disabled={!canDelete}
          onClick={handleDelete}
          className={`btn ${!canDelete ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {loading ? "Suppression…" : "Supprimer définitivement"}
        </button>
      </div>
    </div>
  );
}

/* ======================= Déconnexion centrée (sous Cookies & Mentions) ======================= */
function LogoutCentered() {
  const [loading, setLoading] = useState(false);
  const handleLogout = async () => {
    const supabase = getSupabase();
    setLoading(true);
    try {
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e: any) {
      alert(e?.message || "Déconnexion impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-16 min-h-[35vh] grid place-items-center">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        // Pas de classe 'btn' pour éviter un style blanc : on force noir.
        className="px-0 py-0 bg-transparent border-0 shadow-none text-slate-900 dark:text-slate-900 text-lg md:text-xl font-semibold"
        aria-label="Se déconnecter"
      >
        {loading ? "Déconnexion…" : "Se déconnecter"}
      </button>
    </div>
  );
}

/* ======================= Page principale ======================= */
export default function Page() {
  useSettingsFontSize();

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useLayoutEffect(() => {
    let initial: Prefs = DEFAULT_PREFS;
    let hadStored = false;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        hadStored = true;
        initial = { ...DEFAULT_PREFS, ...JSON.parse(raw) };
      }
    } catch {}
    setPrefs(initial);

    const isDark = hadStored
      ? (initial.theme === "dark" || (initial.theme === "system" && getSystemPrefersDark()))
      : false;
    applyThemeToRoot(isDark);

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(prefs));
    } catch {}
    const isDark =
      prefs.theme === "dark" || (prefs.theme === "system" && getSystemPrefersDark());
    applyThemeToRoot(isDark);
  }, [prefs, loaded]);

  useEffect(() => {
    if (!loaded) return;
    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mql) return;
    const onChange = () => {
      if (prefs.theme === "system") applyThemeToRoot(mql.matches);
    };
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, [prefs.theme, loaded]);

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div className="mb-2">
        <h1
          className="h1"
          style={{ fontSize: "clamp(20px, 2.2vw, 24px)", lineHeight: 1.15, color: "var(--text)" }}
        >
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
                className="rounded-[10px] border px-3 py-2 w-full dark:bg-slate-900 dark:border-slate-700"
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

            {/* Supprimer mon compte */}
            <DeleteAccountCard />
          </div>
        </Section>

        {/* ======================= Section Notifications ======================= */}
        <Section title="Rappel Motivation ">
          <PushScheduleForm />
        </Section>

        {/* ======================= Section Cookies & Mentions ======================= */}
        <Section title="Cookies & Mentions légales">
          <p className="opacity-70 mb-4">
            Consultez ici notre politique de cookies et les mentions légales du site.
          </p>
          <LegalModal />
        </Section>

      /* ======================= Déconnexion centrée (sous Cookies & Mentions) ======================= */
function LogoutCentered() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    const supabase = getSupabase();
    setLoading(true);
    try {
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e: any) {
      alert(e?.message || "Déconnexion impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-16 min-h-[35vh] grid place-items-center">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="appearance-none bg-transparent border-0 shadow-none no-underline text-black dark:text-black text-lg md:text-xl font-semibold"
        style={{ color: "#000", WebkitTextFillColor: "#000" }}
        aria-label="Se déconnecter"
      >
        {loading ? "Déconnexion…" : "Se déconnecter"}
      </button>
    </div>
  );
}
