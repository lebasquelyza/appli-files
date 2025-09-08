import type { Metadata } from "next";
import "./globals.css";
import AuthStatus from "@/components/AuthStatus";

export const metadata: Metadata = {
  title: "Appli Files",
  description: "Connexion Spotify",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header style={{ display: "flex", justifyContent: "flex-end", padding: 12 }}>
          <AuthStatus />
        </header>
        {children}
      </body>
    </html>
  );
}
