import type { ReactNode } from "react";
import ClientTopbar from "./_components/ClientTopbar";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-gray-900">
      <ClientTopbar />
      {/* marge adaptée au header compact (40px) */}
      <main className="pt-10 px-4 sm:px-6 max-w-screen-xl mx-auto">
        {children}
      </main>
      <footer className="mt-10 py-4 text-center text-sm text-gray-500">
        Files Coaching 2025
      </footer>
    </div>
  );
}
