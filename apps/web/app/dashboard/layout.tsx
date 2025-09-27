"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen grid lg:grid-cols-[240px,1fr] grid-rows-[auto,1fr] lg:grid-rows-[1fr] bg-[#f9fafb]">
      {/* --- BARRE LATERALE --- */}
      <aside className="bg-white border-r p-4 flex flex-col justify-between">
        <div>
          <h1 className="text-2xl font-extrabold mb-6">CoachFit</h1>
          <nav className="space-y-2">
            <NavLink href="/dashboard" current={pathname === "/dashboard"}>🏠 Accueil</NavLink>
            <NavLink href="/dashboard/calories" current={pathname.startsWith("/dashboard/calories")}>🔥 Calories</NavLink>
            <NavLink href="/dashboard/corrector" current={pathname.startsWith("/dashboard/corrector")}>🧠 Correcteur IA</NavLink>
            <NavLink href="/dashboard/profile" current={pathname.startsWith("/dashboard/profile")}>💪 Profil</NavLink>
            <NavLink href="/dashboard/abonnement" current={pathname.startsWith("/dashboard/abonnement")}>💳 Abonnement</NavLink>
          </nav>
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

function NavLink({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition ${
        current
          ? "bg-emerald-100 text-emerald-800"
          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {children}
    </Link>
  );
}

