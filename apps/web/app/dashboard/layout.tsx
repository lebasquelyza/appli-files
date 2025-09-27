// apps/web/app/dashboard/layout.tsx
import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import ClientNav from "./_components/ClientNav";
import MobileTabbar from "./_components/MobileTabbar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f9fafb] grid grid-rows-[auto,1fr,auto] lg:grid-rows-[1fr] lg:grid-cols-[240px,1fr]">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex bg-white border-r p-4 flex-col justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-6">CoachFit</h1>
          <ClientNav />
        </div>
        <div className="text-xs text-gray-400 mt-8">
          © {new Date().getFullYear()} CoachFit<br />
          Tous droits réservés.
        </div>
      </aside>

      {/* Topbar */}
      <header className="sticky top-0 z-30 bg-white border-b px-4 sm:px-6 py-3 flex items-center justify-between lg:col-start-2">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">Tableau de bord</span>
          {/* version compacte du titre de l’app pour mobile */}
          <span className="lg:hidden text-xs text-gray-500">CoachFit</span>
        </div>

        <Link
          href="/dashboard/abonnement"
          className="px-3 sm:px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 font-medium text-gray-800"
        >
          Mon abonnement
        </Link>
      </header>

      {/* Contenu */}
      <main className="p-4 sm:p-6 lg:col-start-2">
        {children}
      </main>

      {/* Tabbar (mobile uniquement) */}
      <div className="lg:hidden border-t bg-white sticky bottom-0 z-30">
        <MobileTabbar />
      </div>
    </div>
  );
}
