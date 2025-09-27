// apps/web/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import ClientTopbar from "./_components/ClientTopbar";
import MobileTabbar from "./_components/MobileTabbar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-gray-900 grid grid-rows-[auto,1fr,auto]">
      {/* Barre supérieure avec hamburger */}
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="h-14 max-w-screen-lg mx-auto w-full flex items-center justify-between px-4">
          {/* À gauche: bouton hamburger */}
          <ClientTopbar />

          {/* À droite: lien succinct si tu veux garder “Files Coaching” */}
          <a href="/dashboard/abonnement" className="text-green-600 font-semibold">
            Files Coaching
          </a>
        </div>
      </header>

      {/* Contenu (padding bas pour ne pas être recouvert par le footer fixe) */}
      <main
        className="p-4 sm:p-6"
        style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>

      {/* Footer (ton composant actuel) */}
      <MobileTabbar />
    </div>
  );
}
