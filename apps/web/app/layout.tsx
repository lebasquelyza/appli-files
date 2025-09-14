import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "Appli Files",
  description: "Connexion Spotify",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* Script inline pour appliquer thème/lang dès le premier paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try{
    var raw = localStorage.getItem("app.prefs.v1");
    var prefs = raw ? JSON.parse(raw) : null;
    var systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var isDark = prefs ? (prefs.theme==="dark" || (prefs.theme==="system" && systemDark)) : systemDark;
    var lang = (prefs && prefs.language) || "fr";
    var root = document.documentElement;
    root.classList.toggle("dark", isDark);
    root.setAttribute("data-theme", isDark ? "dark" : "light");
    root.setAttribute("lang", lang);
  }catch(e){}
})();`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
