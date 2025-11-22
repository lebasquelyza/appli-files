// apps/web/app/dashboard/_components/ClientTopbar.tsx
"use client";

import { useLanguage } from "@/components/LanguageProvider";

export default function ClientTopbar() {
  const { lang, setLang } = useLanguage();

  const handleChangeLang = (l: "fr" | "en") => {
    setLang(l); // si ton LanguageProvider écrit aussi le cookie, tout le reste suivra
  };

  return (
    <header
      className="fixed inset-x-0 z-40 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 h-10 flex items-center justify-between">
        {/* Titre statique */}
        <span className="font-bold text-lg leading-none select-none">
          Files Coaching
        </span>

        {/* Boutons FR / EN à droite */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleChangeLang("fr")}
            className={`px-2 py-0.5 rounded-full text-[11px] border transition ${
              lang === "fr"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => handleChangeLang("en")}
            className={`px-2 py-0.5 rounded-full text-[11px] border transition ${
              lang === "en"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
