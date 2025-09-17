import {getRequestConfig} from "next-intl/server";
import {locales, type Locale, defaultLocale} from "../i18n";

export default getRequestConfig(async ({locale}) => {
  const supported = new Set<Locale>(locales as unknown as Locale[]);
  const l: Locale = supported.has(locale as Locale) ? (locale as Locale) : defaultLocale;
  const messages = (await import(`../messages/${l}.json`)).default;
  return { locale: l, messages };
});
