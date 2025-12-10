// apps/web/components/Topbar.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

export default function Topbar({ hideMenu = false }: { hideMenu?: boolean }) {
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false); // 👈 état pour le chabrot

  const router = useRouter();
  const firstBtnRef = useRef<HTMLButtonElement | null>(null);

  const { lang, setLang } = useLanguage();

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstBtnRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <>
      <header className="site-header fixed inset-x-0 top-0 z-[1000] border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="mx-auto max-w-screen-xl h-10 px-3 flex items-center gap-3">
          {/* FILES-Menu */}
          {!hideMenu && (
            <>
              <button
                aria-label="Ouvrir/Fermer le menu"
                onClick={() => setOpen((v) => !v)}
                className="js-topbar-menu inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[.99] transition"
              >
                <span className="relative -ml-1 inline-block h-3 w-4">
                  <span className="absolute inset-x-0 top-0 h-[2px] bg-white" />
                  <span className="absolute inset-x-0 top-1.5 h-[2px] bg-white" />
                  <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white" />
                </span>
                FILES-Menu
              </button>

              {/* 💬 Bulle chabrot juste à droite de FILES-Menu */}
              <button
                type="button"
                aria-label={
                  chatOpen
                    ? "Fermer le chabrot intelligent"
                    : "Ouvrir le chabrot intelligent"
                }
                onClick={() => setChatOpen((v) => !v)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-[.97] transition"
              >
                💬
              </button>
            </>
          )}

          {/* 🔤 Boutons FR / EN juste à côté */}
          <div className="flex items-center gap-1 ml-auto md:ml-0">
            <button
              type="button"
              onClick={() => setLang("fr")}
              className={`px-3 py-1 rounded-full text-xs border ${
                lang === "fr"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-gray-300 bg-white text-gray-900"
              }`}
            >
              🇫🇷 FR
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`px-3 py-1 rounded-full text-xs border ${
                lang === "en"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-gray-300 bg-white text-gray-900"
              }`}
            >
              🇬🇧 EN
            </button>
          </div>
        </div>
      </header>

      {/* 🔽 Panneau du chabrot intelligent (en bas à droite) */}
      {chatOpen && (
        <div className="fixed bottom-4 right-4 z-[1200] w-full max-w-sm sm:max-w-md">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-xl flex flex-col h-[420px] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-900">
                  Chabrot intelligent
                </span>
                <span className="text-[11px] text-gray-500">
                  Pose-moi tes questions sur tes fichiers ou ton dashboard.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800"
                aria-label="Fermer le chabrot"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 text-sm text-gray-700">
              {/* 👉 ICI tu plugges ton vrai chatbot (iframe, widget, composant, etc.) */}
              <p className="mb-2">
                Bonjour 👋, je suis ton chabrot intelligent. Comment puis-je
                t&apos;aider ?
              </p>

              {/* Exemple si tu as une URL d'iframe de chatbot : */}
              {/* 
              <iframe
                src="https://ton-chatbot-url.com/embed"
                className="w-full h-full border-0"
                title="Chabrot IA"
              />
              */}
            </div>
          </div>
        </div>
      )}

      {!hideMenu && open && (
        <div className="fixed inset-0 z-[1100]" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-white flex flex-col">
            <div className="h-10" />
            <nav className="max-w-screen-md mx-auto w-full p-2 pt-[calc(env(safe-area-inset-top)+2px)]">
              <ul className="divide-y">
                {[
                  { href: "/dashboard", label: "Accueil" },
                  { href: "/dashboard/calories", label: "Calories" },
                  { href: "/dashboard/corrector", label: "Correcteur IA" },
                  { href: "/dashboard/profile", label: "Profil" },
                  { href: "/dashboard/abonnement", label: "Abonnement" },
                  { href: "/dashboard/recipes", label: "Recettes" },
                  { href: "/dashboard/progress", label: "Progression" },
                  { href: "/dashboard/settings", label: "Réglages" },
                ].map((item, i) => (
                  <li key={item.href}>
                    <button
                      ref={i === 0 ? firstBtnRef : undefined}
                      onClick={() => go(item.href)}
                      className="w-full text-left py-3 text-lg rounded-md px-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-auto" />
          </div>
        </div>
      )}
    </>
  );
}
