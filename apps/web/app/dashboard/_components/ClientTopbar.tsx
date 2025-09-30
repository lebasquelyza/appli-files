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
      const t = setTimeout(() => firstBtnRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <>
      {/* Bandeau FIXE vert, plein écran (plus de border-b) */}
      <header className="fixed inset-x-0 top-0 z-[1000] bg-emerald-600 text-white shadow-sm">
        <div className="mx-auto max-w-screen-xl h-14 px-4 flex items-center justify-between">
          {/* Bouton hamburger (vert foncé pour contraster) */}
          <button
            aria-label="Ouvrir le menu"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-700 text-white px-5 py-3 text-sm font-semibold shadow hover:bg-emerald-800 active:scale-95 transition"
          >
            <span className="relative block w-6 h-4">
              <span className="absolute inset-x-0 top-0 h-[2px] bg-white" />
              <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-white" />
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white" />
            </span>
            <span>Menu</span>
          </button>

          {/* Rien au centre/droite */}
          <div />
          <div className="w-[104px]" />
        </div>
      </header>

      {/* Panneau plein écran */}
      {open && (
        <div className="fixed inset-0 z-[1100]" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-white flex flex-col">
            {/* Barre supérieure du panneau : verte aussi */}
            <div className="h-14 flex items-center justify-between px-4"
                 style={{ backgroundColor: "#059669", color: "white" /* emerald-600 */ }}>
              <div className="font-extrabold">Menu</div>
              <button
                aria-label="Fermer"
                className="inline-flex items-center justify-center rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20"
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

            {/* Footer du panneau (vide) */}
            <div className="mt-auto border-t py-3 text-center text-sm text-gray-500" />
          </div>
        </div>
      )}
    </>
  );
}


