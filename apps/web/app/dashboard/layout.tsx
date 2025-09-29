// apps/web/app/dashboard/layout.tsx
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-gray-900">
      {/* Contenu */}
      <main className="mx-auto max-w-screen-xl px-4 pb-16">
        {children}
      </main>

      {/* Footer fixe centré */}
      <footer className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="h-12 flex items-center justify-center text-sm text-gray-500">
          Files Coaching 2025
        </div>
      </footer>
    </div>
  );
}
