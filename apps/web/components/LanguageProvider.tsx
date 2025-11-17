//apps/web/components/LanguageProvider.tsx
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

// ✅ On définit les types ici, simplement
type Lang = "fr" | "en";
// Tu peux mettre plus strict plus tard si tu veux
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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  // Détection langue navigateur + localStorage
  useEffect(() => {
    const stored = window.localStorage.getItem("fc-lang") as Lang | null;
    if (stored === "fr" || stored === "en") {
      setLangState(stored);
    } else {
      const nav = navigator.language.toLowerCase();
      if (nav.startsWith("en")) setLangState("en");
      else setLangState("fr");
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      // ✅ l est bien "fr" | "en", donc string
      window.localStorage.setItem("fc-lang", l);
    }
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
