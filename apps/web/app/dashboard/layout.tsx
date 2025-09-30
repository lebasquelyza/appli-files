// apps/web/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import ClientTopbar from "./_components/ClientTopbar";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-gray-900">
      {/* Topbar (hamburger) visible sur toutes les pages du dashboard */}
      <ClientTopbar />

      {/* Contenu des pages : marge en haut pour passer sous le header */}
      <main className="pt-12 px-4 sm:px-6 max-w-screen-xl mx-auto">
        {children}
      </main>

      {/* Footer (facultatif) */}
      <footer className="mt-10 py-4 text-center text-sm text-gray-500">
        Files Coaching 2025
      </footer>
    </div>
  );
}
