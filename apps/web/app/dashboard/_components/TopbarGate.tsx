"use client";

import { usePathname } from "next/navigation";
import Topbar from "../components/Topbar";

export default function TopbarGate() {
  const pathname = usePathname();
  const hideOn = pathname === "/" || pathname === "/signin" || pathname === "/signup";
  return <Topbar hideMenu={hideOn} />;
}

