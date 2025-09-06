import "./globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "Files — Coach Sportif IA",
  description: "Files, votre coach sportif 24/7",
};

// IMPORTANT: empêche le pré-rendu statique qui casse les contexts client
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
