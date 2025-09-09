"use client";
import Link from "next/link";
import { useState } from "react";

export default function Topbar(){
  const [open, setOpen] = useState(false);
  return (
    <header>
      <div className="container nav">
        <Link href="/" className="brand" aria-label="Files">
          <span className="mark" />
          <span>Files</span>
        </Link>
        <nav className={open ? "menu open" : "menu"}>
          <Link href="/#features">Fonctionnalités</Link>
          <Link href="/dashboard/pricing">Abonnement</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
        <button className="burger" aria-label="Menu" onClick={()=>setOpen(v=>!v)}>☰</button>
      </div>
    </header>
  );
}
