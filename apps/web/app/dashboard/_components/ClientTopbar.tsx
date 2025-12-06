// apps/web/app/dashboard/_components/ClientTopbar.tsx
"use client";

import { useLanguage } from "@/components/LanguageProvider";

export default function ClientTopbar() {
  const { lang, setLang } = useLanguage();

  return (
    <header
      className="fixed inset-x-0 z-40 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 h-10 flex items-center justify-between">
        {/* Titre */}
        <span className="font-bold text-lg leading-none select-none">
          Files Coaching
        </span>

        {/* Switch langue à droite (même logique que le reste) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLang("fr")}
            className={
              "px-2 py-0.5 rounded-full text-[11px] border " +
              (lang === "fr"
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50")
            }
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={
              "px-2 py-0.5 rounded-full text-[11px] border " +
              (lang === "en"
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50")
            }
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
