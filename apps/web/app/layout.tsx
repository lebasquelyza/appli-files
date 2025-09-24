// apps/web/app/layout.tsx
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
  // Optionnel: si tu as un manifest PWA
  // manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Viewport mobile + encoche iOS */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* Déclare que ta page gère les deux thèmes (évite le flash) */}
        <meta name="color-scheme" content="light dark" />
        {/* Theme-color adaptatif (navigateurs modernes) */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0b0b" />
        {/* iOS Web App plein écran (facultatif) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Script inline ultra-tôt: applique thème/lang avant le premier paint */}
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
    // Fix hauteur mobile (100dvh fiable) + safe-areas pour paddings utilitaires
    var setVH = function() {
      var vh = window.innerHeight * 0.01;
      root.style.setProperty("--vh", vh + "px");
      // expose aussi les insets iOS
      root.style.setProperty("--sat", (envSafe('top') || 0) + 'px');
      root.style.setProperty("--sar", (envSafe('right') || 0) + 'px');
      root.style.setProperty("--sab", (envSafe('bottom') || 0) + 'px');
      root.style.setProperty("--sal", (envSafe('left') || 0) + 'px');
    };
    function envSafe(side){
      try {
        // Certains navigateurs ne résolvent pas env() ici, on garde un fallback 0
        return parseInt(getComputedStyle(root).getPropertyValue('env(safe-area-inset-' + side + ')')) || 0;
      } catch(_) { return 0; }
    }
    setVH();
    window.addEventListener("resize", setVH);
  } catch (e) {}
})();`,
          }}
        />
        {/* Fallback no-JS: suit le thème système */}
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
          // Hauteur fiable sur mobile (100 * var(--vh))
          "min-h-[calc(var(--vh,1vh)*100)]",
          // Couleurs du design system (shadcn/ui / Tailwind)
          "bg-background text-foreground antialiased",
          // Espace sûr avec encoches (utilise var --sa* définies plus haut)
          "pt-[max(env(safe-area-inset-top),var(--sat,0px))]",
          "pb-[max(env(safe-area-inset-bottom),var(--sab,0px))]",
        ].join(" ")}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
