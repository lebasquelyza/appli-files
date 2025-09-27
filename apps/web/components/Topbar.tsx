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

  // Focus initial dans le panel quand on ouvre
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstBtnRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto max-w-screen-xl px-4 py-3 flex items-center justify-between">
        {/* Bouton hamburger à gauche */}
        <button
          aria-label="Ouvrir le menu"
          className="inline-flex items-center justify-center rounded-lg border px-3 py-2 hover:bg-gray-50 active:scale-[0.99]"
          onClick={() => setOpen(true)}
        >
          <span className="sr-only">Menu</span>
          <span className="relative block w-5 h-3">
            <span className="absolute inset-x-0 top-0 h-[2px] bg-gray-900"></span>
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-gray-900"></span>
            <span className="absolute inset-x-0 bottom-0 h-[2px] bg-gray-900"></span>
          </span>
          {/* Texte visible "Menu" UNIQUEMENT ici */}
          <span className="ml-2 text-sm font-semibold">Menu</span>
        </button>

        {/* Centre vide (pas de titre) */}
        <div className="text-sm font-semibold tracking-wide text-gray-900" />

        {/* Espace à droite pour équilibrer */}
        <div className="w-[42px]" />

        {/* Overlay plein écran */}
        {open && (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="menuTitle">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-white flex flex-col">
              {/* Titre uniquement pour lecteurs d’écran (pas visible) */}
              <h2 id="menuTitle" className="sr-only">Menu</h2>

              {/* Barre du panel : uniquement le bouton fermer (pas de texte "Menu") */}
              <div className="h-14 flex items-center justify-end px-4 border-b">
                <button
                  aria-label="Fermer"
                  className="inline-flex items-center justify-center rounded-lg border px-3 py-2 hover:bg-gray-50"
                  onClick={() => setOpen(false)}
                >
                  ✕
                </button>
              </div>

              {/* Liens */}
              <nav className="max-w-screen-md mx-auto w-full p-4">
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
                        className="w-full text-left py-4 text-lg hover:bg-gray-50 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Footer du panneau */}
              <div className="mt-auto border-t py-3 text-center text-sm text-gray-500">
                Files Coaching 2025
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
