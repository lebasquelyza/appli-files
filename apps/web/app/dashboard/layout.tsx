// apps/web/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import MobileTabbar from "./_components/MobileTabbar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-gray-900 grid grid-rows-[auto,1fr,auto] lg:grid-rows-[1fr] lg:grid-cols-[240px,1fr]">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex border-r bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 p-4 flex-col justify-between">
        <div />
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
        <div />
      </aside>

      {/* Top bar minimal (pas de “Dashboard/CF CoachFit”) */}
      <header className="sticky top-0 z-30 lg:col-start-2 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="h-12 max-w-screen-lg mx-auto w-full flex items-center justify-end px-4">
          <Link href="/dashboard/abonnement" className="text-green-600 font-semibold">
            Files Coaching
          </Link>
        </div>
      </header>

      {/* Contenu (avec padding bas pour ne pas être caché par le footer) */}
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
