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

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstBtnRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <>
      {/* Header SANS barre : transparent + pas de border */}
      <header className="fixed inset-x-0 top-0 z-[1000] bg-transparent">
        <div className="mx-auto max-w-screen-xl h-12 px-4 flex items-center">
          {/* Bouton hamburger : plus grand + vert */}
          <button
            aria-label="Ouvrir le menu"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-emerald-600 text-white font-semibold shadow hover:bg-emerald-700 active:scale-[0.99] transition"
            onClick={() => setOpen(true)}
          >
            <span className="relative block w-5 h-3">
              <span className="absolute inset-x-0 top-0 h-[2px] bg-white" />
              <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-white" />
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white" />
            </span>
            Menu
          </button>
        </div>
      </header>

      {/* Panneau plein écran BLANC, pas de bande verte ni titre “Menu” */}
      {open && (
        <div className="fixed inset-0 z-[1100]" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-white flex flex-col">
            {/* Barre du haut minimaliste : juste le bouton fermer à droite */}
            <div className="h-14 flex items-center justify-end px-4">
              <button
                aria-label="Fermer"
                className="inline-flex items-center justify-center rounded-full border px-3 py-2 hover:bg-gray-50"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Liens */}
            <nav className="max-w-screen-md mx-auto w-full p-4">
              <ul className="space-y-3">
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
                      className="w-full text-left px-4 py-3 rounded-xl border bg-gray-50 hover:bg-gray-100 font-medium"
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


