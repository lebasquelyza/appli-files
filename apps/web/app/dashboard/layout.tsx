import type { ReactNode } from "react";
import ClientTopbar from "./_components/ClientTopbar";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-white text-gray-900">
        {/* Hamburger visible partout */}
        <ClientTopbar />

        {/* Contenu calé juste sous la barre (40px + safe area) */}
        <main className="pt-[calc(40px+env(safe-area-inset-top))] px-4 sm:px-6 max-w-screen-xl mx-auto">
          {children}
        </main>

        {/* Footer (facultatif) */}
        {/* <footer className="mt-10 py-4 text-center text-sm text-gray-500">
          Files Coaching 2025
        </footer> */}
      </body>
    </html>
  );
}
