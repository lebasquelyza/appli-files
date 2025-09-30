// apps/web/app/layout.tsx
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import Topbar from "@/components/Topbar";
import "./globals.css";

// === PWA metadata ===
export const metadata = {
  title: "Files",
  description: "Votre coach forme & bien-être",
  manifest: "/manifest.json",
  themeColor: "#ffffff",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Files" // <-- nom affiché sous l’icône iOS
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: { url: "/icon-192.png", sizes: "192x192", type: "image/png" }
  }
};


// (tes options existantes)
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
