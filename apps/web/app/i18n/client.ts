// apps/web/app/i18n/client.ts
"use client";

import { useMemo } from "react";
import { translations } from "./translations";

export type SupportedLocale = keyof typeof translations;

// Pour l’instant on force le FR par défaut
const DEFAULT_LOCALE: SupportedLocale = "fr";

function getNested(obj: any, path: string): any {
  return path
    .split(".")
    .reduce(
      (acc, key) =>
        acc && typeof acc === "object" && key in acc ? acc[key] : undefined,
      obj
    );
}

/**
 * Petit hook client pour lire les traductions.
 *
 * Usage :
 *   const { t, lang } = useTranslation();
 *   t("calories.page.title");
 *   t("connect.alerts.connected", { name: "Strava" });
 */
export function useTranslation(locale?: SupportedLocale) {
  const lang: SupportedLocale =
    (locale && translations[locale] ? locale : DEFAULT_LOCALE);

  const t = useMemo(
    () =>
      (key: string, vars?: Record<string, string | number>) => {
        const raw = (getNested(translations[lang], key) ??
          key) as string;

        if (!vars) return raw;

        return Object.entries(vars).reduce((acc, [k, v]) => {
          return acc.replace(
            new RegExp(`{{\\s*${k}\\s*}}`, "g"),
            String(v)
          );
        }, raw);
      },
    [lang]
  );

  return { t, lang };
}
