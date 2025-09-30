"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function ClientTopbar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const firstBtnRef = useRef<HTMLButtonElement | null>(null);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  // focus sur le 1er lien quand on ouvre
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstBtnRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <>
      {/* Header compact (hauteur 40px) */}
      <header className="fixed inset-x-0 top-0 z-[1000] border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto max-w-screen-xl h-10 px-3 flex items-center justify-between">
          {/* Même bouton = toggle ouvrir/fermer */}
          <button
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium
                       bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.99] transition"
          >
            {/* petite icône burger */}
            <span className="relative -ml-1 inline-block h-3 w-4">
              <span className="absolute inset-x-0 top-0 h-[2px] bg-white" />
              <span className="absolute inset-x-0 top-1.5 h-[2px] bg-white" />
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white" />
            </span>
            Menu
          </button>

          {/* espace à droite pour équilibrer */}
          <div className="w-[42px]" />
        </div>
      </header>

      {/* Panneau plein écran minimal (pas de barre “Menu”, pas de croix) */}
      {open && (
        <div className="fixed inset-0 z-[1100]" role="dialog" aria-modal="true">
          {/* cliquer en dehors ferme */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-white flex flex-col">
            {/* un peu de marge en haut, plus compact */}
            <nav className="max-w-screen-md mx-auto w-full p-3 pt-2">
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
                      className="w-full text-left py-3 text-lg hover:bg-gray-50 rounded-md px-2
                                 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
