import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import TopbarGate from "./_components/TopbarGate";
import "./globals.css";
import Providers from "@/components/Providers"; // ✅ ton SessionProvider

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
  viewportFit: "cover", // ✅ important pour iOS (safe-area)
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-white text-gray-900 min-h-dvh">
        <Providers>
          {/* ✅ Topbar global */}
          <TopbarGate />

          {/* 
            ✅ Gestion de la safe-area via CSS (classe .app-shell qu'on va définir dans globals.css)
            - padding-top prend en compte l’encoche + un peu d’espace
            - padding-bottom protège du geste "home" sur iPhone
          */}
          <main className="app-shell">
            {children}
          </main>
        </Providers>

        {/* Fallback runtime: expose env publiques si besoin */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__env = {
  NEXT_PUBLIC_SUPABASE_URL: ${JSON.stringify(
    process.env.NEXT_PUBLIC_SUPABASE_URL || null
  )},
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${JSON.stringify(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null
  )}
};`,
          }}
        />
      </body>
    </html>
  );
}
