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

// 🔎 lit le cookie fc-lang côté client
function readCookieLang(): Lang | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;)\s*fc-lang=(fr|en)/);
  const val = match?.[1];
  return val === "en" || val === "fr" ? val : null;
}

// ✍️ écrit le cookie fc-lang côté client
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

  // ✅ Détection avec priorité au cookie, puis au téléphone/navigateur
  useEffect(() => {
    try {
      // 1) cookie en priorité
      const fromCookie = readCookieLang();
      if (fromCookie) {
        setLangState(fromCookie);
        return;
      }

      // 2) sinon langue du navigateur
      const nav = navigator.language.toLowerCase();
      const autoLang: Lang = nav.startsWith("en") ? "en" : "fr";
      setLangState(autoLang);
      // on écrit aussi le cookie pour que le serveur soit aligné
      writeCookieLang(autoLang);
    } catch {
      setLangState("fr");
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    writeCookieLang(l); // 🔁 garde le serveur et le client synchronisés
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
