"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  translations,
  type Lang,
  type Messages,
} from "@/app/i18n/translations";

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
      window.localStorage.setItem("fc-lang", l);
    }
  };

  const messages = useMemo(() => translations[lang], [lang]);

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
