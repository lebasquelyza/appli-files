// apps/web/app/dashboard/_components/ClientTopbar.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClientTopbar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      {/* Bouton hamburger */}
      <button
        aria-label="Ouvrir le menu"
        className="inline-flex items-center justify-center rounded-lg border px-3 py-2 hover:bg-gray-50 active:scale-[0.99]"
        onClick={() => setOpen(true)}
      >
        <span className="sr-only">Menu</span>
        {/* Icône hamburger en pur CSS */}
        <span className="relative block w-5 h-3">
          <span className="absolute inset-x-0 top-0 h-[2px] bg-gray-900"></span>
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-gray-900"></span>
          <span className="absolute inset-x-0 bottom-0 h-[2px] bg-gray-900"></span>
        </span>
      </button>

      {/* Overlay plein écran */}
      {open && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
        >
          {/* Fond */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* Panneau centré (plein écran sur mobile) */}
          <div className="absolute inset-0 bg-white">
            {/* Entête du menu */}
            <div className="h-14 flex items-center justify-between px-4 border-b">
              <div className="font-extrabold">Menu</div>
              <button
                aria-label="Fermer"
                className="inline-flex items-center justify-center rounded-lg border px-3 py-2 hover:bg-gray-50"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Liens */}
            <nav className="max-w-screen-md mx-auto p-4">
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
                ].map((item) => (
                  <li key={item.href}>
                    <button
                      onClick={() => go(item.href)}
                      className="w-full text-left py-4 text-lg hover:bg-gray-50 rounded-md px-2"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Optionnel : liens secondaires */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="text-sm text-gray-500 hover:underline"
                >
                  Site
                </Link>
                <Link
                  href="/logout"
                  onClick={() => setOpen(false)}
                  className="text-sm text-red-600 hover:underline justify-self-end"
                >
                  Déconnexion
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
