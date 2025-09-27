// apps/web/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-gray-900 grid grid-rows-[auto,1fr,auto] lg:grid-rows-[1fr] lg:grid-cols-[240px,1fr]">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex border-r bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 p-4 flex-col justify-between">
        {/* En-tête vide (on ne montre plus “CF CoachFit”) */}
        <div />

        {/* Navigation principale */}
        <nav className="space-y-2">
          <Link href="/dashboard" className="block rounded-lg px-3 py-2 hover:bg-gray-50">
            <span className="mr-2">🏠</span> Accueil
          </Link>
          <Link href="/dashboard/calories" className="block rounded-lg px-3 py-2 hover:bg-gray-50">
            <span className="mr-2">🔥</span> Calories
          </Link>
          <Link href="/dashboard/corrector" className="block rounded-lg px-3 py-2 hover:bg-gray-50">
            <span className="mr-2">🧠</span> Correcteur IA
          </Link>
          <Link href="/dashboard/profile" className="block rounded-lg px-3 py-2 hover:bg-gray-50">
            <span className="mr-2">💪</span> Profil
          </Link>
          <Link href="/dashboard/abonnement" className="block rounded-lg px-3 py-2 hover:bg-gray-50">
            <span className="mr-2">🧾</span> Abonnement
          </Link>
        </nav>

        {/* Pied de colonne vide */}
        <div />
      </aside>

      {/* Barre supérieure (mobile + desktop) – minimal, pas de “Dashboard” */}
      <header className="sticky top-0 z-30 lg:col-start-2 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="h-12 max-w-screen-lg mx-auto w-full flex items-center justify-end px-4">
          <Link
            href="/dashboard/abonnement"
            className="text-green-600 font-semibold"
          >
            Files Coaching
          </Link>
        </div>
      </header>

      {/* Contenu */}
      <main
        className="p-4 sm:p-6 lg:col-start-2"
        style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>

      {/* Footer mobile centré */}
      <MobileTabbar />
    </div>
  );
}

/* ---------- composant client: footer centré ---------- */
"use client";
function MobileTabbar() {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div
        className="mx-auto max-w-screen-sm h-14 flex items-center justify-center px-4"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <span className="text-xs font-semibold text-gray-800">
          Files Coaching 2025
        </span>
      </div>
    </footer>
  );
}

