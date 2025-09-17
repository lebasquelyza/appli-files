"use client";

import {usePathname, useRouter, useSearchParams} from "next/navigation";

const locales = ["fr","en","de"] as const;
type Locale = typeof locales[number];
const LS_KEY = "app.prefs.v1";

export default function LanguageSwitcher({compact = false}: {compact?: boolean}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // locale actuelle = 1er segment de l'URL
  const segs = (pathname || "/").split("/");
  const current = (locales as readonly string[]).includes(segs[1]) ? (segs[1] as Locale) : "fr";

  function changeLocale(nextLocale: Locale) {
    if (!pathname) return;

    // remplace le segment [locale] dans l'URL
    const parts = pathname.split("/");
    if (parts.length < 2) parts.splice(1, 0, nextLocale);
    else parts[1] = nextLocale;

    const qs = searchParams?.toString();
    const nextUrl = parts.join("/") + (qs ? `?${qs}` : "");

    // mémorise aussi dans les prefs locales
    try {
      const raw = localStorage.getItem(LS_KEY);
      const prefs = raw ? JSON.parse(raw) : {};
      localStorage.setItem(LS_KEY, JSON.stringify({...prefs, language: nextLocale}));
      // met l'attribut lang immédiatement
      document.documentElement.setAttribute("lang", nextLocale);
    } catch {}

    router.replace(nextUrl);
  }

  if (compact) {
    // petite version (menu déroulant)
    return (
      <select
        aria-label="Langue"
        className="rounded-[10px] border px-3 py-2 text-sm"
        value={current}
        onChange={(e) => changeLocale(e.target.value as Locale)}
      >
        <option value="fr">FR</option>
        <option value="en">EN</option>
        <option value="de">DE</option>
      </select>
    );
  }

  // version boutons
  return (
    <div className="inline-flex gap-1.5 rounded-[12px]" style={{ padding:"6px", background:"var(--panel)", border:"1px solid rgba(0,0,0,.06)" }}>
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => changeLocale(l)}
          className="px-3 py-1.5 rounded-[10px] text-sm font-semibold"
          style={{
            color: current === l ? "#fff" : "var(--muted)",
            background: current === l ? "linear-gradient(90deg,var(--brand),var(--brand2))" : "transparent",
            boxShadow: current === l ? "var(--shadow)" : "none"
          }}
          aria-pressed={current === l}
          title={l.toUpperCase()}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
