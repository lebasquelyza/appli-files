"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/Page";
import { useI18n } from "@/components/i18n/I18nProvider";

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

export default function Page() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function switchLocale(newLocale: "fr" | "en" | "de") {
    if (!pathname) return;
    const segs = pathname.split("/");
    if (segs.length < 2) segs.splice(1, 0, newLocale);
    else segs[1] = newLocale;
    const qs = searchParams?.toString();
    const nextUrl = segs.join("/") + (qs ? `?${qs}` : "");
    try {
      const raw = localStorage.getItem(LS_KEY);
      const st = raw ? JSON.parse(raw) : {};
      localStorage.setItem(LS_KEY, JSON.stringify({...st, language: newLocale}));
      document.documentElement.setAttribute("lang", newLocale);
    } catch {}
    router.replace(nextUrl);
  }

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
    setMsg(t("settings.actions.saved") || "Réglages enregistrés ✅");
    const tmo = setTimeout(() => setMsg(null), 1200);
    return () => clearTimeout(tmo);
  }, [prefs, loaded, t]);

  const sampleDate = useMemo(() => {
    const d = new Date(2025, 8, 14, 16, 7);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh24 = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const hh12n = d.getHours() % 12 || 12;
    const ampm = d.getHours() < 12 ? "AM" : "PM";
    const date = prefs.dateFormat === "dd/mm/yyyy" ? `${dd}/${mm}/${yyyy}` : `${mm}/${dd}/${yyyy}`;
    const time = prefs.timeFormat === "24h" ? `${hh24}:${min}` : `${hh12n}:${min} ${ampm}`;
    return `${date} · ${time}`;
  }, [prefs.dateFormat, prefs.timeFormat]);

  return (
    <>
      <PageHeader title={t("settings.general.title")} subtitle={t("settings.general.subtitle")} />

      <Section title={t("settings.general.title")}>
        <div className="space-y-6">
          <div className="card">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {t("settings.general.intro")}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Langue */}
            <div className="card space-y-3">
              <div className="space-y-1">
                <h3 className="font-semibold">{t("settings.language")}</h3>
              </div>
              <select
                className="rounded-[10px] border px-3 py-2 text-sm w-full"
                value={prefs.language}
                onChange={(e) => {
                  const lang = e.target.value as Prefs["language"];
                  setPrefs((p) => ({ ...p, language: lang }));
                  switchLocale(lang);
                }}
                disabled={!loaded}
              >
                <option value="fr">Français (FR)</option>
                <option value="en">English (EN)</option>
                <option value="de">Deutsch (DE)</option>
              </select>
            </div>

            {/* Thème */}
            <div className="card space-y-3">
              <div className="space-y-1">
                <h3 className="font-semibold">{t("settings.theme")}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-dash" aria-pressed={prefs.theme==="light"} onClick={() => setPrefs(p => ({ ...p, theme: "light" }))}>
                  {t("settings.theme.light")}
                </button>
                <button type="button" className="btn-dash" aria-pressed={prefs.theme==="dark"} onClick={() => setPrefs(p => ({ ...p, theme: "dark" }))}>
                  {t("settings.theme.dark")}
                </button>
                <button type="button" className="btn-dash" aria-pressed={prefs.theme==="system"} onClick={() => setPrefs(p => ({ ...p, theme: "system" }))}>
                  {t("settings.theme.system")}
                </button>
              </div>
            </div>

            {/* Date & heure */}
            <div className="card space-y-3">
              <div className="space-y-1">
                <h3 className="font-semibold">{t("settings.dateTime")}</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm" style={{ color: "var(--muted)" }}>
                    {t("settings.date")}
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
                    {t("settings.time")}
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
                <span style={{ color: "var(--muted)" }}>{t("settings.preview")} : </span>
                <span>{sampleDate}</span>
              </div>
            </div>

            {/* Accessibilité / cookies plus tard */}
            <div className="card space-y-3">
              <div className="space-y-1">
                <h3 className="font-semibold">{t("settings.accessibility")}</h3>
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
            </div>
          </div>

          {/* Actions */}
          <div className="card flex items-center justify-between gap-4">
            <button
              type="button"
              className="btn-dash"
              onClick={() => {
                setPrefs(DEFAULT_PREFS);
                setMsg(t("settings.actions.reset") || "Réglages réinitialisés");
                setTimeout(() => setMsg(null), 1200);
              }}
              disabled={!loaded}
            >
              {t("settings.actions.reset")}
            </button>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              {msg ?? t("settings.actions.autoSave")}
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
