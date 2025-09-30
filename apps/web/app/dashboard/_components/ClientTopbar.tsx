// apps/web/app/dashboard/_components/ClientTopbar.tsx
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

  // Focus sur le 1er lien quand on ouvre le menu
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstBtnRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <>
      {/* Barre du haut (toujours visible) */}
      <header className="fixed inset-x-0 top-0 z-[1000] border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="mx-auto max-w-screen-xl h-12 px-4 flex items-center justify-between">
          {/* Bouton hamburger vert (ouvre/ferme) */}
          <button
            type="button"
            aria-label="Ouvrir/fermer le menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700 active:scale-[.98] transition"
          >
            <span className="relative -ml-1 inline-block h-3 w-4">
              <span className="absolute inset-x-0 top-0 h-[2px] bg-white" />
              <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-white" />
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white" />
            </span>
            Menu
          </button>

          {/* Rien au centre / à droite */}
          <div />
          <div className="w-[44px]" />
        </div>
      </header>

      {/* Panneau plein écran */}
      {open && (
        <div className="fixed inset-0 z-[1100]" role="dialog" aria-modal="true">
          {/* overlay (clic pour fermer) */}
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          {/* panneau */}
          <div className="absolute inset-0 bg-white flex flex-col">
            {/* Navigation — padding réduit en haut, safe-area respectée */}
            <nav className="max-w-screen-md mx-auto w-full p-2 pt-[calc(env(safe-area-inset-top)+4px)]">
              <ul className="list-none pl-0 m-0 space-y-2">
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
                      className="w-full text-left py-3 text-lg rounded-md px-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
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

