import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "Appli Files",
  description: "Connexion Spotify",
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "apple-touch-icon", url: "/icons/apple-touch-icon.png" },
  ],
  // manifest: "/manifest.webmanifest", // si tu as une PWA
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0b0b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Applique thème/lang + vars mobile avant le 1er paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
    var raw = localStorage.getItem("app.prefs.v1");
    var prefs = raw ? JSON.parse(raw) : null;
    var systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var isDark = prefs ? (prefs.theme === "dark" || (prefs.theme === "system" && systemDark)) : systemDark;
    var lang = (prefs && prefs.language) || "fr";
    var root = document.documentElement;
    root.classList.toggle("dark", !!isDark);
    root.setAttribute("data-theme", isDark ? "dark" : "light");
    root.setAttribute("lang", lang);
    // Hauteur mobile fiable
    var setVH = function() {
      var vh = window.innerHeight * 0.01;
      root.style.setProperty("--vh", vh + "px");
    };
    setVH();
    window.addEventListener("resize", setVH);
  } catch (e) {}
})();`,
          }}
        />
        <noscript>
          <style>{`
            :root { color-scheme: light dark; }
            @media (prefers-color-scheme: dark) {
              html { background: #0b0b0b; }
            }
          `}</style>
        </noscript>
      </head>

      <body
        className={[
          "min-h-[calc(var(--vh,1vh)*100)]",
          "bg-background text-foreground antialiased",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        ].join(" ")}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
