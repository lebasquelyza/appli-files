"use client";

import { useEffect, useRef, useState } from "react";
import { Section } from "@/components/ui/Page"; // ← plus de PageHeader ici

/** ——— Texte un peu plus petit partout (sauf le h1) ——— */
function useSettingsFontSize() {
  useEffect(() => {
    const fs = getComputedStyle(document.body).fontSize || "16px";
    const num = parseFloat(fs) || 16;
    const smaller = Math.max(11, Math.round(num - 4)); // ajuste si besoin
    document.documentElement.style.setProperty("--settings-fs", `${smaller}px`);
  }, []);
}

/** Bouton discret (hérite la taille) */
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
  value: string; // "HH:mm"
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

/* ======================= Mentions légales (ouverture via « Cookies ») ======================= */
function LegalModal() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, []);

  // Verrouille le scroll du body quand la modale est ouverte
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="card space-y-3" style={{ fontSize: "var(--settings-fs)" }}>
      <button
        type="button"
        className={btnGhost}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Cookies / Mentions légales
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mentions légales et politique de cookies"
          className="fixed inset-0 z-[100] flex sm:items-center items-end justify-center sm:p-4 p-0"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            onTouchMove={(e) => e.preventDefault()}
          />

          {/* Dialog */}
          <div
            ref={wrap}
            className="relative z-[101] w-full sm:max-w-3xl sm:rounded-2xl sm:border bg-white sm:p-5 p-4 shadow-2xl sm:max-h-[85vh] sm:h-auto h-[90vh] overflow-y-scroll overscroll-contain"
            style={{
              fontSize: "var(--settings-fs)",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-base font-semibold">Mentions légales</h3>
              <button aria-label="Fermer" className={btnGhost} onClick={() => setOpen(false)}>
                Fermer
              </button>
            </div>

            <div className="mt-3 space-y-4 leading-relaxed">
              <section>
                <h4 className="font-semibold">1) Éditeur du site</h4>
                <p>
                  <strong>Raison sociale :</strong>{" "}
                  <span className="opacity-80">VOTRE SOCIÉTÉ</span>
                  <br />
                  <strong>Forme juridique :</strong>{" "}
                  <span className="opacity-80">SAS / SARL / Auto-entrepreneur</span>
                  <br />
                  <strong>Siège social :</strong>{" "}
                  <span className="opacity-80">Adresse complète</span>
                  <br />
                  <strong>Capital social :</strong> <span className="opacity-80">XX XXX €</span>
                  <br />
                  <strong>RCS / SIREN :</strong> <span className="opacity-80">XXXXXXXXX</span>
                  <br />
                  <strong>TVA intracommunautaire :</strong>{" "}
                  <span className="opacity-80">FRXXXXXXXXXX</span>
                  <br />
                  <strong>Contact :</strong>{" "}
                  <span className="opacity-80">email@domaine.tld • +33 X XX XX XX XX</span>
                </p>
              </section>

              <section>
                <h4 className="font-semibold">2) Directeur·rice de la publication</h4>
                <p>
                  <span className="opacity-80">Nom et prénom du/de la responsable légal·e.</span>
                </p>
              </section>

              <section>
                <h4 className="font-semibold">3) Hébergeur</h4>
                <p>
                  <strong>Nom :</strong>{" "}
                  <span className="opacity-80">[OVH / Scaleway / Vercel / Autre]</span>
                  <br />
                  <strong>Adresse :</strong> <span className="opacity-80">Adresse postale</span>
                  <br />
                  <strong>Téléphone :</strong> <span className="opacity-80">Numéro</span>
                </p>
              </section>

              <section>
                <h4 className="font-semibold">4) Propriété intellectuelle</h4>
                <p className="opacity-80">
                  Le contenu de ce site (textes, images, logos, marques, vidéos, codes, etc.) est
                  protégé par le droit de la propriété intellectuelle. Toute reproduction,
                  représentation, adaptation ou exploitation, totale ou partielle, est interdite sans
                  autorisation préalable.
                </p>
              </section>

              <section>
                <h4 className="font-semibold">5) Données personnelles &amp; cookies</h4>
                <p className="opacity-80">
                  Nous utilisons des cookies et technologies similaires à des fins de fonctionnement
                  du site, de mesure d’audience et, le cas échéant, de personnalisation. Vous pouvez
                  à tout moment paramétrer vos choix via le bouton ci-dessous. Pour plus
                  d’informations, consultez notre politique de confidentialité.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => {
                      alert(
                        "Ouvrir le gestionnaire de préférences cookies (branchez ici votre CMP si vous en avez un)."
                      );
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
              </section>

              <section>
                <h4 className="font-semibold">6) Responsabilité</h4>
                <p className="opacity-80">
                  Nous nous efforçons d’assurer l’exactitude et la mise à jour des informations du
                  site. Toutefois, des erreurs ou omissions peuvent survenir et l’éditeur ne saurait
                  en être tenu pour responsable.
                </p>
              </section>

              <section>
                <h4 className="font-semibold">7) Contact</h4>
                <p className="opacity-80">
                  Pour toute question relative aux mentions légales ou à vos données personnelles :
                  <br />
                  Email : <span>email@domaine.tld</span> — Téléphone : <span>+33 X XX XX XX XX</span>
                </p>
              </section>

              <p className="text-xs opacity-60">Dernière mise à jour : 30/09/2025</p>
            </div>
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
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return alert("Sauvegarde KO: " + (j.error ?? res.status));
      alert("Rappel enregistré ✅");
    } catch (e: any) {
      alert("Erreur: " + (e?.message || String(e)));
    }
  };

  return (
    <div className="card space-y-4" style={{ fontSize: "var(--settings-fs)" }}>
      <h3 className="font-semibold" style={{ fontSize: "calc(var(--settings-fs) + 2px)" }}>
        Rappel planifié
      </h3>
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

/* ======================= Préférences visuelles ======================= */
type Prefs = {
  language: "fr" | "en" | "de";
  theme: "light" | "dark" | "system";
  reducedMotion: boolean;
};
const LS_KEY = "app.prefs.v1";
const DEFAULT_PREFS: Prefs = { language: "fr", theme: "system", reducedMotion: false };

/* ======================= Page Réglages ======================= */
export default function Page() {
  useSettingsFontSize(); // petite taille pour tout (sauf h1)

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
    root.style.setProperty("--reduce-motion", prefs.reducedMotion ? "1" : "0");
    document.body.style.animationDuration = prefs.reducedMotion ? "0s" : "";
    document.body.style.transitionDuration = prefs.reducedMotion ? "0s" : "";
    root.setAttribute("lang", prefs.language);
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  }, [prefs, loaded]);

  return (
    // Wrapper avec paddingTop pour ne pas passer dessous la Topbar
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      {/* Titre principal — même taille que “Bienvenue” (22px) */}
      <div className="mb-2">
        <h1 className="h1" style={{ fontSize: 22, color: "#111827" }}>
          Réglages
        </h1>
      </div>

      {/* Tout le reste hérite de la petite taille */}
      <div style={{ fontSize: "var(--settings-fs)" }}>
        <Section title="Général">
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Langue */}
              <div className="card space-y-3">
                <h3 className="font-semibold" style={{ fontSize: "calc(var(--settings-fs) + 2px)" }}>
                  Langue
                </h3>
                <select
                  className="rounded-[10px] border px-3 py-2 w-full"
                  value={prefs.language}
                  onChange={(e) =>
                    setPrefs((p) => ({ ...p, language: e.target.value as Prefs["language"] }))
                  }
                  disabled={!loaded}
                  style={{ fontSize: "var(--settings-fs)" }}
                >
                  <option value="fr">Français (FR)</option>
                  <option value="en">English (EN)</option>
                  <option value="de">Deutsch (DE)</option>
                </select>
              </div>

              {/* Thème */}
              <div className="card space-y-3">
                <h3 className="font-semibold" style={{ fontSize: "calc(var(--settings-fs) + 2px)" }}>
                  Thème
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(["light", "dark", "system"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={btnGhost}
                      style={{ fontSize: "var(--settings-fs)" }}
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

        <Section title="Notifications push (beta)">
          <div className="card space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <button
                type="button"
                className={btnGhost}
                style={{ fontSize: "var(--settings-fs)" }}
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
                style={{ fontSize: "var(--settings-fs)" }}
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
            <LegalModal />
          </div>
        </Section>
      </div>
    </div>
  );
}
