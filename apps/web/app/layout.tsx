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
  viewportFit: "cover", // 👉 seule ligne ajoutée pour iOS
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-white text-gray-900 min-h-dvh">
        <Providers>
          {/* ✅ Topbar incluse dans le provider — elle pourra aussi utiliser useSession */}
          <TopbarGate />

          <main style={{ paddingTop: "calc(env(safe-area-inset-top) + 40px)" }}>
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
