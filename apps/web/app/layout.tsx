// apps/web/app/layout.tsx
import type { ReactNode } from "react";
import Topbar from "@/components/Topbar";
import "./globals.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-white text-gray-900 min-h-dvh">
        {/* Topbar visible partout */}
        <div className="relative z-50">
          <Topbar />
        </div>

        {/* On décale le contenu pour ne pas qu'il passe sous la barre (≈ h-12) */}
        <div className="pt-3">
          {children}
        </div>
      </body>
    </html>
  );
}
