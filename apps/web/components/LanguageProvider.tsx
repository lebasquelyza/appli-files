// apps/web/components/LanguageProvider.tsx
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { translations } from "@/app/i18n/translations";

type Lang = "fr" | "en";
type Messages = any;

type LanguageContextType = {
  lang: Lang;
  messages: Messages;
  setLang: (lang: Lang) => void;
  t: (path: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

const COOKIE_KEY_V2 = "fc-lang-v2";
const COOKIE_KEY_OLD = "fc-lang";

function getFromPath(obj: any, path: string): string {
  return path.split(".").reduce((acc, key) => acc?.[key], obj) ?? path;
}

// lit fc-lang-v2 ou, à défaut, l’ancien fc-lang
function readInitialLang(): Lang {
  if (typeof document === "undefined") return "fr";

  // 1) nouveau cookie
  const matchV2 = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + COOKIE_KEY_V2 + "=(fr|en)")
  );
  const v2 = matchV2?.[1] as Lang | undefined;
  if (v2 === "fr" || v2 === "en") return v2;

  // 2) ancien cookie
  const matchOld = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + COOKIE_KEY_OLD + "=(fr|en)")
  );
  const old = matchOld?.[1] as Lang | undefined;
  if (old === "fr" || old === "en") return old;

  // 3) défaut
  return "fr";
}

function writeCookieLang(lang: Lang) {
  if (typeof document === "undefined") return;

  const common = ["Path=/", "SameSite=Lax", "Max-Age=31536000"].join("; ");

  // ✅ on écrit les DEUX cookies pour compatibilité
  document.cookie = `${COOKIE_KEY_V2}=${lang};${common}`;
  document.cookie = `${COOKIE_KEY_OLD}=${lang};${common}`;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    const initial = readInitialLang();
    setLangState(initial);
    writeCookieLang(initial);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    writeCookieLang(l);
  };

  const messages = useMemo<Messages>(() => {
    return translations[lang] as Messages;
  }, [lang]);

  const t = (path: string) => getFromPath(messages, path);

  const value: LanguageContextType = {
    lang,
    messages,
    setLang,
    t,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return ctx;
}

