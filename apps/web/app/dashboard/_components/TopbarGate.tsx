"use client";
import { usePathname } from "next/navigation";
import ClientTopbar from "@/components/ClientTopbar"; // <-- le topbar utilisé au root

export default function TopbarGate() {
  const p = (usePathname() || "/").replace(/\/+$/, "");
  const hide = p === "" || p === "/" || p === "/signin" || p === "/signup";
  if (hide) return null;         // → pas de topbar sur /, /signin, /signup
  return <ClientTopbar />;       // → topbar partout ailleurs (dashboard, etc.)
}
