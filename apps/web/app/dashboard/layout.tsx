// apps/web/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import RegisterSW from "@/components/RegisterSW";
import Sidebar from "../../components/Sidebar";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RegisterSW />

      <div
        className="px-4 sm:px-6 max-w-screen-xl mx-auto"
        style={{
          // ⬅️ annule le paddingTop global du RootLayout
          marginTop: "calc(-40px - env(safe-area-inset-top))",
          paddingBottom: "var(--mobile-tabbar, 0px)",
        }}
      >
        <div className="md:hidden">
          <Sidebar />
        </div>

        <section>{children}</section>

        {/* ⬇️ ICI : on force le centrage avec style textAlign:"center" */}
        <footer
          className="mt-10 py-4 text-sm text-gray-500"
          style={{ textAlign: "center" }}
        >
          Files Coaching 2025
        </footer>
      </div>
    </>
  );
}
