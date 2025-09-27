// apps/web/app/dashboard/_components/ClientNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ClientNav() {
  const pathname = usePathname();

  const Item = ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition ${
          active
            ? "bg-emerald-100 text-emerald-800"
            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        {children}
      </Link>
    );
  };

  return (
    <nav className="space-y-2">
      <Item href="/dashboard">🏠 Accueil</Item>
      <Item href="/dashboard/calories">🔥 Calories</Item>
      <Item href="/dashboard/corrector">🧠 Correcteur IA</Item>
      <Item href="/dashboard/profile">💪 Profil</Item>
      <Item href="/dashboard/abonnement">💳 Abonnement</Item>
    </nav>
  );
}
