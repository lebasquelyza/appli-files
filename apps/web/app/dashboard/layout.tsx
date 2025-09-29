// apps/web/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import ClientTopbar from "./_components/ClientTopbar";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-white text-gray-900">
        {/* ✅ Le hamburger est toujours présent ici */}
        <ClientTopbar />

        {/* ✅ Le contenu de chaque page, y compris celle avec “Bienvenue” */}
        <main className="pt-14 px-4 sm:px-6 max-w-screen-xl mx-auto">
          {children}
        </main>

        {/* ✅ Footer si tu veux le remettre */}
        <footer className="mt-10 py-4 text-center text-sm text-gray-500">
          Files Coaching 2025
        </footer>
      </body>
    </html>
  );
}
