import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import Topbar from "@/components/Topbar";
import "./globals.css";

// === PWA / App name ===
export const metadata: Metadata = {
  title: "Files Coaching",
  description: "Coaching & bien-être",
  manifest: "/manifest.json",
  themeColor: "#ffffff",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Files Coaching",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

// Tes options existantes
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
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 56px)" }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
