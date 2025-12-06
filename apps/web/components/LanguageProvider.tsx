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

function getFromPath(obj: any, path: string): string {
  return path.split(".").reduce((acc, key) => acc?.[key], obj) ?? path;
}

// 🔑 Cookie unique pour la langue
const COOKIE_KEY = "fc-lang-v2";

// lit fc-lang-v2 côté client
function readCookieLang(): Lang | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + COOKIE_KEY + "=(fr|en)")
  );
  const val = match?.[1];
  return val === "fr" || val === "en" ? val : null;
}

// écrit fc-lang-v2 côté client
function writeCookieLang(lang: Lang) {
  if (typeof document === "undefined") return;
  document.cookie = [
    `${COOKIE_KEY}=${lang}`,
    "Path=/",
    "SameSite=Lax",
    "Max-Age=31536000", // 1 an
  ].join("; ");
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // FR par défaut (avant lecture du cookie)
  const [lang, setLangState] = useState<Lang>("fr");

  // ⚡ init : cookie v2 > FR par défaut
  useEffect(() => {
    const fromCookie = readCookieLang();
    if (fromCookie) {
      setLangState(fromCookie);
    } else {
      setLangState("fr");
      writeCookieLang("fr");
    }
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
