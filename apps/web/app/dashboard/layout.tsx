// apps/web/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import ClientTopbar from "./_components/ClientTopbar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-gray-900">
      <ClientTopbar />
      {/* Laisser de la place sous la barre fixe (≈ 64px) */}
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        {children}
      </main>
    </div>
  );
}
