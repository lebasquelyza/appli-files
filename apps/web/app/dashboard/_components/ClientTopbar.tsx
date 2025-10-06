"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function ClientTopbar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathnameHook = usePathname(); // peut être null pendant l'hydration
  const [path, setPath] = useState("/");

  // 1) Source de vérité du chemin (hook + fallback window)
  useEffect(() => {
    const p =
      (pathnameHook || (typeof window !== "undefined" ? window.location.pathname : "/")) || "/";
    setPath(p.replace(/\/+$/, "")); // retire / final
  }, [pathnameHook]);

  // 2) Cacher le bouton sur /, /signin, /signup
  const hideMenu = path === "" || path === "/" || path === "/signin" || path === "/signup";

  const firstBtnRef = useRef<HTMLButtonElement | null>(null);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  // Focus sur le premier item quand le panneau s'ouvre
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstBtnRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Si on est sur une page où le menu doit être caché, ferme le panneau
  useEffect(() => {
    if (hideMenu && open) setOpen(false);
  }, [hideMenu, open]);

  return (
    <>
      {/* Barre fixe (40px) */}
      <header className="fixed inset-x-0 top-0 z-[1000] border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="mx-auto max-w-screen-xl h-10 px-3 flex items-center justify-between">
          {/* Bouton Menu — retiré sur /, /signin, /signup */}
          {hideMenu ? (
            <div className="w-[72px]" aria-hidden />
          ) : (
            <button
              aria-label="Ouvrir/Fermer le menu"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[.99] transition"
            >
              <span className="relative -ml-1 inline-block h-3 w-4">
                <span className="absolute inset-x-0 top-0 h-[2px] bg-white" />
                <span className="absolute inset-x-0 top-1.5 h-[2px] bg-white" />
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white" />
              </span>
              Menu
            </button>
          )}

          {/* Rien au centre/droite pour rester épuré */}
          <div />
          <div className="w-[42px]" />
        </div>
      </header>

      {/* Panneau plein écran — pas rendu si hideMenu */}
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
