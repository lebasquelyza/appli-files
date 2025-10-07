"use client";

import { usePathname } from "next/navigation";
import Topbar from "../components/Topbar"; // Topbar = ton hamburger

// Pages où on NE veut PAS afficher le bouton/menu
const HIDE = new Set<string>(["/", "/signin", "/signup"]);

export default function TopbarGate() {
  const pathname = usePathname() || "/";

  if (HIDE.has(pathname)) {
    // Ne rien rendre => plus aucun bouton "Menu" sur ces pages
    return null;
  }

  return <Topbar />;
}
