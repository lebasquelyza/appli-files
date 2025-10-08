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
          // ⬇️ plus de paddingTop ici (on le met dans la sidebar)
          paddingTop: 0,
          paddingBottom: "var(--mobile-tabbar, 0px)",
        }}
      >
        {/* Sidebar uniquement en mobile */}
        <div className="md:hidden">
          <Sidebar />
        </div>

        <section>{children}</section>

        <footer className="mt-10 py-4 text-center text-sm text-gray-500">
          Files Coaching 2025
        </footer>
      </div>
    </>
  );
}

