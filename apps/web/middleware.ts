import createMiddleware from "next-intl/middleware";
import {locales, defaultLocale} from "./i18n";

export default createMiddleware({
  locales: Array.from(locales),
  defaultLocale
});

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"], // exclut /api, /_next, assets
};
