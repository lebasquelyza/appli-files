// apps/web/components/Topbar.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function Topbar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const firstBtnRef = useRef<HTMLButtonElement | null>(null);

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
      {/* Barre fixe (même style que ClientTopbar) */}
      <header className="fixed inset-x-0 top-0 z-[1000] border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="mx-auto max-w-screen-xl h-10 px-3 flex items-center justify-between">
          {/* Bouton Menu (toggle) */}
          <button
            aria-label="Ouvrir/Fermer le menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[.99] transition"
          >
            {/* 3 barres */}
            <span className="relative -ml-1 inline-block h-3 w-4">
              <span className="absolute inset-x-0 top-0 h-[2px] bg-white" />
              <span className="absolute inset-x-0 top-1.5 h-[2px] bg-white" />
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white" />
            </span>
            Menu
          </button>

          {/* Rien au centre/droite pour rester épuré */}
          <div />
          <div className="w-[42px]" />
        </div>
      </header>

      {/* Panneau plein écran sans titre "Menu" en haut (même que ClientTopbar) */}
      {open && (
        <div className="fixed inset-0 z-[1100]" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-white flex flex-col">
            {/* espace top pour encoche */}
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

            {/* Fermer depuis le bas si besoin */}
            <div className="mt-auto p-2">
              <button
                onClick={() => setOpen(false)}
                className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[.99]"
                aria-label="Fermer le menu"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
