// apps/web/app/dashboard/layout.tsx
import Link from "next/link";
import { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[240px,1fr] grid-rows-[auto,1fr] lg:grid-rows-[1fr] bg-[#f9fafb]">
      {/* --- BARRE LATERALE --- */}
      <aside className="bg-white border-r p-4 flex flex-col justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-6">CoachFit</h1>
          <ClientNav />
        </div>
        <div className="text-xs text-gray-400 mt-8">
          © {new Date().getFullYear()} CoachFit<br />
          Tous droits réservés.
        </div>
      </aside>

      {/* --- BARRE SUPÉRIEURE --- */}
      <header className="sticky top-0 bg-white border-b px-6 py-3 flex items-center justify-between">
        <h2 className="font-bold text-lg">Tableau de bord</h2>
        <Link
          href="/dashboard/abonnement"
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 font-medium text-gray-800"
        >
          Gérer mon abonnement
        </Link>
      </header>

      {/* --- CONTENU --- */}
      <main className="p-6">{children}</main>
    </div>
  );
}

/* -------- composant client pour l’état actif -------- */
"use client";
import { usePathname } from "next/navigation";

function ClientNav() {
  const pathname = usePathname();
  const LinkItem = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const current = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition ${
          current ? "bg-emerald-100 text-emerald-800" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        {children}
      </Link>
    );
  };

  return (
    <nav className="space-y-2">
      <LinkItem href="/dashboard">🏠 Accueil</LinkItem>
      <LinkItem href="/dashboard/calories">🔥 Calories</LinkItem>
      <LinkItem href="/dashboard/corrector">🧠 Correcteur IA</LinkItem>
      <LinkItem href="/dashboard/profile">💪 Profil</LinkItem>
      <LinkItem href="/dashboard/abonnement">💳 Abonnement</LinkItem>
    </nav>
  );
}
