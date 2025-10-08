// apps/web/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import RegisterSW from "@/components/RegisterSW";
import Sidebar from "../../components/Sidebar"; // adapte si besoin

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const safeTop = "env(safe-area-inset-top)";

  return (
    <>
      <RegisterSW />

      <div
        className="px-4 sm:px-6 max-w-screen-xl mx-auto"
        style={{
          // plus de topbar -> uniquement le safe area
          paddingTop: safeTop,
          // si MobileTabbar défini, le main évite le chevauchement
          paddingBottom: "var(--mobile-tabbar, 0px)",
        }}
      >
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          {/* Sidebar desktop (sticky) */}
          <aside
            className="hidden md:block"
            style={{
              position: "sticky",
              top: safeTop,
              height: `calc(100dvh - ${safeTop})`,
              overflowY: "auto",
            }}
          >
            <Sidebar />
          </aside>

          {/* Contenu */}
          <section>{children}</section>
        </div>

        <footer className="mt-10 py-4 text-center text-sm text-gray-500">
          Files Coaching 2025
        </footer>
      </div>
    </>
  );
}
