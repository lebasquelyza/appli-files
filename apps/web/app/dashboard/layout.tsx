// apps/web/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import RegisterSW from "@/components/RegisterSW";
import Sidebar from "../../components/Sidebar"; // garde ce chemin si ton Sidebar est bien là

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const safeTop = "env(safe-area-inset-top)";

  return (
    <>
      <RegisterSW />

      <div
        className="px-4 sm:px-6 max-w-screen-xl mx-auto"
        style={{
          paddingTop: safeTop,                         // pas de topbar -> juste le safe area
          paddingBottom: "var(--mobile-tabbar, 0px)",  // si tu utilises MobileTabbar
        }}
      >
        {/* 👇 Sidebar visible UNIQUEMENT en mobile */}
        <div className="md:hidden">
          <Sidebar />
        </div>

        {/* Contenu (plein écran sur mobile & desktop) */}
        <section>{children}</section>

        <footer className="mt-10 py-4 text-center text-sm text-gray-500">
          Files Coaching 2025
        </footer>
      </div>
    </>
  );
}

