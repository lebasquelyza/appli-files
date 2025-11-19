// apps/web/app/…/loading.tsx
import { cookies } from "next/headers";
import { translations } from "@/app/i18n/translations";

type Lang = "fr" | "en";

function getFromPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function tServer(lang: Lang, path: string, fallback?: string): string {
  const dict = translations[lang] as any;
  const v = getFromPath(dict, path);
  if (typeof v === "string") return v;
  return fallback ?? path;
}

function getLang(): Lang {
  const cookieLang = cookies().get("fc-lang")?.value;
  if (cookieLang === "en") return "en";
  return "fr";
}

export default function Loading() {
  const lang = getLang();
  const t = (path: string, fallback?: string) => tServer(lang, path, fallback);

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <div className="card">
        <h2 style={{ margin: 0 }}>
          {t("common.loading", "Chargement…")}
        </h2>
      </div>
    </div>
  );
}
