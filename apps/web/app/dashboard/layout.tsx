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
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex border-r bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 p-4 flex-col justify-between">
        {/* En-tête supprimé (plus de “CF CoachFit”) */}
        <div>
          <ClientNav />
        </div>

        {/* Lien bas de sidebar (tu peux changer le texte si tu veux) */}
        <div className="text-[11px] text-gray-400">
          <Link href="/dashboard/files-coaching" className="underline hover:text-gray-600">
            Files Coaching
          </Link>
        </div>
      </aside>

      {/* Topbar (enlève le mot “Dashboard”) */}
      <header className="sticky top-0 z-30 lg:col-start-2 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-end">
          {/* Bouton à droite */}
          <Link
            href="/dashboard/files-coaching"
            className="inline-flex items-center px-3 sm:px-4 py-2 rounded-xl border hover:bg-gray-50 transition"
          >
            Files Coaching
          </Link>
        </div>
      </header>
{/* Contenu */}
<main className="p-4 sm:p-6 pb-24 lg:col-start-2">
  {children}
</main>

{/* Pied de page mobile */}
<MobileTabbar />
