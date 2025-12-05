"use client";

import { useMemo } from "react";
import { translations } from "@/app/i18n/translations";

type Lang = "fr" | "en";

function getFromPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function tClient(lang: Lang, path: string, fallback?: string): string {
  const dict = translations[lang] as any;
  const v = getFromPath(dict, path);
  if (typeof v === "string") return v;
  return fallback ?? path;
}

function getLangFromCookie(): Lang {
  if (typeof document === "undefined") return "fr";
  const m = document.cookie.match(/(?:^|;\s*)fc-lang=(en)\b/);
  if (m) return "en";
  return "fr";
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const lang = useMemo<Lang>(() => getLangFromCookie(), []);
  const t = (path: string, fallback?: string) => tClient(lang, path, fallback);

  const message =
    error?.message ||
    t("common.error.unknown", lang === "en" ? "Unknown error" : "Erreur inconnue");

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="card">
        <h2 style={{ margin: 0 }}>
          {t("common.error.title", lang === "en" ? "Oops" : "Oups")}
        </h2>
        <p
          className="text-sm"
          style={{ whiteSpace: "pre-wrap", color: "#6b7280" }}
        >
          {message}
          {error?.digest ? `\n(digest: ${error.digest})` : ""}
        </p>
        <button className="btn btn-dash" onClick={() => reset()}>
          {t("common.error.reload", lang === "en" ? "Reload" : "Recharger")}
        </button>
      </div>
    </div>
  );
}
