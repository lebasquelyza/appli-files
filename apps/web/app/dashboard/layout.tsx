// apps/web/app/dashboard/layout.tsx
import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import ClientNav from "./_components/ClientNav";
import MobileTabbar from "./_components/MobileTabbar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-gray-900 grid grid-rows-[auto,1fr,auto] lg:grid-rows-[1fr] lg:grid-cols-[240px,1fr]">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex border-r bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 p-4 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-xl bg-black text-white grid place-items-center font-bold">CF</div>
            <h1 className="text-xl font-extrabold tracking-tight">CoachFit</h1>
          </div>
          <ClientNav />
        </div>

        {/* ↓↓↓ REMPLACÉ ICI ↓↓↓ */}
        <div className="text-[11px] text-gray-400">
          <Link href="/dashboard/files-coaching" className="underline hover:text-gray-600">
            Files Coaching
          </Link>
        </div>
        {/* ↑↑↑ REMPLACÉ ICI ↑↑↑ */}
      </aside>

      {/* Topbar */}
      <header className="sticky top-0 z-30 lg:col-start-2 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold">Dashboard</span>
            <span className="lg:hidden text-xs text-gray-500">CoachFit</span>
          </div>

          {/* Bouton entête (tu peux le laisser ou le changer au besoin) */}
          <Link
            href="/dashboard/files-coaching"
            className="inline-flex items-center px-3 sm:px-4 py-2 rounded-xl border hover:bg-gray-50 transition"
          >
            Files Coaching
          </Link>
        </div>
      </header>

      {/* Contenu */}
      <main className="p-4 sm:p-6 lg:col-start-2">
        {children}
      </main>

      {/* Tabbar mobile + mini pied de page mobile */}
      <div className="lg:hidden sticky bottom-0 z-30">
        <MobileTabbar />
        {/* ↓↓↓ Ajout d'un petit lien en bas de page sur mobile ↓↓↓ */}
        <div className="text-center text-[11px] text-gray-400 py-2 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-t">
          <Link href="/dashboard/files-coaching" className="underline">
            Files Coaching
          </Link>
        </div>
        {/* ↑↑↑ Ajout mobile ↑↑↑ */}
      </div>
    </div>
  );
}

