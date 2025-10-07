import type { ReactNode } from "react";
import ClientTopbar from "./_components/ClientTopbar";
import RegisterSW from "@/components/RegisterSW";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-white text-gray-900">
        <ClientTopbar />
        <RegisterSW />
        {/* Le padding-top correspond EXACTEMENT à la barre : safe-area + 40px */}
        <main
          className="px-4 sm:px-6 max-w-screen-xl mx-auto"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 40px)" }}
        >
          {children}
        </main>
        <footer className="mt-10 py-4 text-center text-sm text-gray-500">
          Files Coaching 2025
        </footer>
      </body>
    </html>
  );
}
