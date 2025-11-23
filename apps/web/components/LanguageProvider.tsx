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

// lit fc-lang côté client
function readCookieLang(): Lang | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)fc-lang=(fr|en)/);
  const val = match?.[1];
  return val === "fr" || val === "en" ? val : null;
}

// écrit fc-lang côté client
function writeCookieLang(lang: Lang) {
  if (typeof document === "undefined") return;
  document.cookie = [
    `fc-lang=${lang}`,
    "Path=/",
    "SameSite=Lax",
    "Max-Age=31536000", // 1 an
  ].join("; ");
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  // init : cookie > langue du téléphone > FR
  useEffect(() => {
    try {
      const fromCookie = readCookieLang();
      if (fromCookie) {
        setLangState(fromCookie);
        return;
      }

      const nav = navigator.language.toLowerCase();
      const auto: Lang = nav.startsWith("en") ? "en" : "fr";
      setLangState(auto);
    } catch {
      setLangState("fr");
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
