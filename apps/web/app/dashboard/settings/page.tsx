"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Section } from "@/components/ui/Page";

// ---- Types & constantes ----
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

// ---- Page Réglages (avec Notifications intégrées) ----
export default function Page() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Charger depuis localStorage au mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setPrefs({ ...DEFAULT_PREFS, ...parsed });
      }
    } catch {}
    setLoaded(true);
  }, []);

  // Appliquer en live : thème + reduced-motion + (ex) lang
  useEffect(() => {
    if (!loaded) return;

    // Thème
    const root = document.documentElement;
    const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const isDark = prefs.theme === "dark" || (prefs.theme === "system" && systemDark);

    root.classList.toggle("dark", isDark);
    root.setAttribute("data-theme", isDark ? "dark" : "light");

    // Reduced motion
    root.style.setProperty("--reduce-motion", prefs.reducedMotion ? "1" : "0");
    document.body.style.animationDuration = prefs.reducedMotion ? "0s" : "";
    document.body.style.transitionDuration = prefs.reducedMotion ? "0s" : "";

    // (Optionnel) Langue au niveau du document pour l’accessibilité
    root.setAttribute("lang", prefs.language);

    // Sauvegarde
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));

    // Feedback
    setMsg("Réglages enregistrés ✅");
    const t = setTimeout(() => setMsg(null), 1200);
    return () => clearTimeout(t);
  }, [prefs, loaded]);

  // Exemple d’aperçu formaté
  const sampleDate = useMemo(() => {
    const d = new Date(2025, 8, 14, 16, 7); // 14/09/2025 16:07
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh24 = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const hh12n = d.getHours() % 12 || 12;
    const ampm = d.getHours() < 12 ? "AM" : "PM";

    const date =
      prefs.dateFormat === "dd/mm/yyyy" ? `${dd}/${mm}/${yyyy}` : `${mm}/${dd}/${yyyy}`;
    const time =
      prefs.timeFormat === "24h" ? `${hh24}:${min}` : `${hh12n}:${min} ${ampm}`;

    return `${date} · ${time}`;
  }, [prefs.dateFormat, prefs.timeFormat]);

  return (
    <>
      <PageHeader title="Réglages" subtitle="Préférences de l’application" />

      {/* --- Section Général (inchangée) --- */}
      <Section title="Général">
        <div className="space-y-6">
          {/* Intro */}
          <div className="card">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Configure la langue, le thème, et le format date/heure. Les changements
              sont appliqués immédiatement et mémorisés sur cet appareil.
            </p>
          </div>

          {/* Grille des préférences */}
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

            {/* Format date & heure */}
            <div className="card space-y-3">
              <div className="space-y-1">
                <h3 className="font-semibold">Format date & heure</h3>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Personnalise l’affichage selon tes habitudes.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm" style={{ color: "var(--muted)" }}>
                    Date
                  </label>
                  <select
                    className="rounded-[10px] border px-3 py-2 text-sm w-full"
                    value={prefs.dateFormat}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, dateFormat: e.target.value as Prefs["dateFormat"] }))
                    }
                    disabled={!loaded}
                  >
                    <option value="dd/mm/yyyy">JJ/MM/AAAA</option>
                    <option value="mm/dd/yyyy">MM/JJ/AAAA</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm" style={{ color: "var(--muted)" }}>
                    Heure
                  </label>
                  <select
                    className="rounded-[10px] border px-3 py-2 text-sm w-full"
                    value={prefs.timeFormat}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, timeFormat: e.target.value as Prefs["timeFormat"] }))
                    }
                    disabled={!loaded}
                  >
                    <option value="24h">24h</option>
                    <option value="12h">12h</option>
                  </select>
                </div>
              </div>

              <div className="text-sm">
                <span style={{ color: "var(--muted)" }}>Aperçu&nbsp;: </span>
                <span>{sampleDate}</span>
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

      {/* --- Nouvelle Section : Notifications (déplacée depuis Dashboard) --- */}
      // --- Section Push (beta) ---
<Section title="Notifications push (beta)">
  <div className="card space-y-3">
    <p className="text-sm" style={{ color: "var(--muted)" }}>
      Fonctionnent même si l’app est fermée. Autorise les notifications puis active
      la souscription sur cet appareil.
    </p>

    <div className="flex flex-wrap gap-8 items-center">
      <button
        type="button"
        className="btn-dash"
        onClick={async () => {
          // demande permission
          if ("Notification" in window && Notification.permission === "default") {
            await Notification.requestPermission();
          }
          const { ensurePushSubscription, getDeviceId } = await import("@/lib/pushClient");
          const sub = await ensurePushSubscription(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!);
          const deviceId = getDeviceId();

          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceId, subscription: sub }),
          });
          alert("Notifications push activées ✅");
        }}
      >
        Activer sur cet appareil
      </button>

      <button
        type="button"
        className="btn-dash"
        onClick={async () => {
          const { getDeviceId } = await import("@/lib/pushClient");
          const deviceId = getDeviceId();
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceId }),
          });
          // et annule la souscription navigateur
          const reg = await navigator.serviceWorker.ready;
          const s = await reg.pushManager.getSubscription();
          await s?.unsubscribe();
          alert("Notifications push désactivées");
        }}
      >
        Désactiver
      </button>

      <button
        type="button"
        className="btn-dash"
        onClick={async () => {
          const { getDeviceId } = await import("@/lib/pushClient");
          const deviceId = getDeviceId();
          await fetch("/api/push/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              deviceId,
              payload: {
                title: "CoachFit",
                body: "Test push : prêt·e pour 10 min ? 💪",
                url: "/dashboard",
              },
            }),
          });
        }}
      >
        Envoyer un test
      </button>
    </div>

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
        </div>
      </Section>
    </>
  );
}
