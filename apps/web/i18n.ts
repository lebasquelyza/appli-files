import type {LocalePrefix} from "next-intl/routing";
export const locales = ["fr","en","de"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";
export const localePrefix = "always" satisfies LocalePrefix;
