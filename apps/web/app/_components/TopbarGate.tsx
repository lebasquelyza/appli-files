// apps/web/app/_components/TopbarGate.tsx
"use client";

import { usePathname } from "next/navigation";
import Topbar from "../components/Topbar"; // la topbar publique

const HIDE_EXACT = ["/", "/signin", "/signup"];

export default function TopbarGate() {
  const pathname = usePathname() || "/";

  // Ne rien afficher sur les pages publiques et TOUT le dashboard
  if (HIDE_EXACT.includes(pathname) || pathname.startsWith("/dashboard")) {
    return null;
  }

  // Sinon, affiche la topbar publique
  return <Topbar />;
}
