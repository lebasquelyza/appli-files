// apps/web/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import Topbar from "@/components/Topbar"; // <-- ton hamburger
// (le footer centré en bas reste dans ce layout)

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-gray-900">
      {/* Topbar/hamburger — toujours visible */}
      <div className="relative z-50">
        <Topbar />
      </div>

      {/* Contenu — un peu de padding en haut/bas pour ne pas chevaucher topbar/footer */}
      <main className="mx-auto max-w-screen-xl px-4 pt-3 pb-16">
        {children}
      </main>

      {/* Footer fixe centré en bas */}
      <footer className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="h-12 flex items-center justify-center text-sm text-gray-500">
          Files Coaching 2025
        </div>
      </footer>
    </div>
  );
}
