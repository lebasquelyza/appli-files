import type { ReactNode } from "react";
import Topbar from "@/components/Topbar";
import "./globals.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-white text-gray-900 min-h-dvh">
        <Topbar />
        {/* 48px (h-12) + safe-area iOS */}
        <div
          className="min-h-dvh"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 48px)" }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
