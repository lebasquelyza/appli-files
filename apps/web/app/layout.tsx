import "./globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "Files",
  description: "Coaching app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
