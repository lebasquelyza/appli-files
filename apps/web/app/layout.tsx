//apps/web/app/layout.tsx
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script"; // 👈 AJOUT

import TopbarGate from "./_components/TopbarGate";
import "./globals.css";
import Providers from "@/components/Providers"; // ✅ ton SessionProvider
import { LanguageProvider } from "@/components/LanguageProvider"; // ✅ ajout
import { AuthProvider } from "@/components/AuthProvider"; // ✅ NOUVEL IMPORT

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
  viewportFit: "cover", // 👉 seule ligne ajoutée pour iOS
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* 👇 Script Google AdSense */}
        <Script
          id="adsense-script"
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6468882840325295"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className="bg-white text-gray-900 min-h-dvh">
        <Providers>
          <LanguageProvider>
            <AuthProvider>
              {/* ✅ Topbar incluse dans les providers */}
              <TopbarGate />

              <main style={{ paddingTop: "calc(env(safe-area-inset-top) + 40px)" }}>
                {children}
              </main>
            </AuthProvider>
          </LanguageProvider>
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
