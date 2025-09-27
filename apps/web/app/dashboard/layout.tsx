// apps/web/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import Topbar from "@/components/Topbar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-gray-900 grid grid-rows-[auto,1fr,auto]">
      {/* Topbar avec hamburger (ouvre un panneau plein écran) */}
      <Topbar />

      {/* Contenu */}
      <main className="p-4 sm:p-6">
        {children}
      </main>

      {/* Footer minimal, centré, sans icône */}
      <footer className="border-t bg-white">
        <div className="mx-auto max-w-screen-xl py-3 text-center text-sm text-gray-500">
          Files Coaching 2025
        </div>
      </footer>
    </div>
  );
}
