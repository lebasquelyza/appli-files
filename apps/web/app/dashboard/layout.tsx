// apps/web/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import ClientTopbar from "./_components/ClientTopbar";
import RegisterSW from "@/components/RegisterSW";
import Sidebar from "../../components/layout/Sidebar";
 // ⬅️ assure-toi que le chemin est bon

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const topbarOffset = "calc(env(safe-area-inset-top) + 40px)";

  return (
    <>
      {/* Topbar spécifique au dashboard (si tu en veux une en plus de celle du root) */}
      <ClientTopbar />
      <RegisterSW />

      <div className="px-4 sm:px-6 max-w-screen-xl mx-auto" style={{ paddingTop: topbarOffset }}>
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          {/* Sidebar desktop */}
          <aside
            className="hidden md:block"
            style={{
              position: "sticky",
              top: topbarOffset,
              height: `calc(100dvh - ${topbarOffset})`,
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
