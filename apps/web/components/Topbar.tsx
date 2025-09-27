// apps/web/components/Topbar.tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";

const LINKS = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/dashboard/calories", label: "Calories" },
  { href: "/dashboard/corrector", label: "Correcteur IA" },
  { href: "/dashboard/profile", label: "Profil" },
  { href: "/dashboard/abonnement", label: "Abonnement" },
  { href: "/dashboard/recipes", label: "Recettes" },
  { href: "/dashboard/progress", label: "Progression" },
  { href: "/dashboard/settings", label: "Réglages" },
];

export default function Topbar() {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto max-w-screen-xl h-12 px-3 flex items-center justify-between">
        {/* Bouton hamburger : "Menu" (le seul texte visible) */}
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <button
              aria-label="Ouvrir le menu"
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium hover:bg-gray-50 active:scale-[.98] transition"
            >
              {/* icône burger simple */}
              <span className="relative -ml-1 inline-block h-3 w-4">
                <span className="absolute inset-x-0 top-0 h-[2px] bg-black" />
                <span className="absolute inset-x-0 top-1.5 h-[2px] bg-black" />
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-black" />
              </span>
              Menu
            </button>
          </Dialog.Trigger>

          {/* Panneau plein écran */}
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/30" />
            <Dialog.Content className="fixed inset-0 bg-white overflow-y-auto focus:outline-none">
              {/* Titre invisible pour l’accessibilité → évite d’avoir “Menu” affiché 2x */}
              <Dialog.Title className="sr-only">Menu</Dialog.Title>

              {/* Barre du haut du panneau (uniquement le bouton fermer, pas de texte) */}
              <div className="sticky top-0 z-10 flex items-center justify-end border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-3 h-12">
                <Dialog.Close asChild>
                  <button
                    aria-label="Fermer le menu"
                    className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium hover:bg-gray-50"
                  >
                    ✕
                  </button>
                </Dialog.Close>
              </div>

              {/* Liens */}
              <nav className="mx-auto max-w-md p-4 space-y-3">
                {LINKS.map((l) => (
                  <Dialog.Close asChild key={l.href}>
                    <Link
                      href={l.href}
                      className="block rounded-full border bg-gray-900 text-white text-center px-4 py-3 text-base font-semibold hover:opacity-95 active:scale-[.99] transition"
                    >
                      {l.label}
                    </Link>
                  </Dialog.Close>
                ))}
              </nav>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* On ne met rien à droite (plus de “Files Coaching 2025” en haut) */}
        <div />
      </div>
    </header>
  );
}
