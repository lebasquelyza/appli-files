"use client";

import React, {createContext, useContext, useMemo} from "react";

type Messages = Record<string, any>;
type Ctx = { locale: string; messages: Messages; t: (key: string) => string };

const I18nCtx = createContext<Ctx | null>(null);

function lookup(messages: Messages, key: string): string | undefined {
  // 1) clé plate (ex: "settings.general.title")
  if (typeof messages[key] === "string") return messages[key] as string;
  // 2) objets imbriqués (ex: messages.settings.general.title)
  const parts = key.split(".");
  let cur: any = messages;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function I18nProvider({locale, messages, children}: {locale: string; messages: Messages; children: React.ReactNode}) {
  const t = useMemo(() => (key: string) => lookup(messages, key) ?? key, [messages]);
  const value = useMemo(() => ({locale, messages, t}), [locale, messages, t]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
