import type { Metadata } from "next";
import "../globals.css";
import {I18nProvider} from "@/components/i18n/I18nProvider";

export const metadata: Metadata = {
  title: "Appli Files",
  description: "Connexion Spotify",
};

async function loadMessages(locale: string) {
  const supported = ["fr","en","de"];
  const l = supported.includes(locale) ? locale : "fr";
  const mod = await import(`../../messages/${l}.json`);
  return mod.default;
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await loadMessages(locale);

  return (
    <html lang={locale}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try{
    var raw = localStorage.getItem("app.prefs.v1");
    var prefs = raw ? JSON.parse(raw) : null;
    var systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var isDark = prefs ? (prefs.theme==="dark" || (prefs.theme==="system" && systemDark)) : systemDark;
    var root = document.documentElement;
    root.classList.toggle("dark", isDark);
    root.setAttribute("data-theme", isDark ? "dark" : "light");
  }catch(e){}
})();`,
          }}
        />
      </head>
      <body>
        <I18nProvider locale={locale} messages={messages}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
