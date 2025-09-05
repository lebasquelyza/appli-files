// apps/web/app/(auth)/sign-in/page.tsx
"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await signIn("credentials", {
      email, password, redirect: true, callbackUrl: "/",
    });
    // NextAuth gère la redirection si credentials valides
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="max-w-sm w-full space-y-3">
        <h1 className="text-2xl font-semibold">Connexion</h1>
        <input
          className="w-full border rounded p-2"
          type="email" placeholder="Email"
          value={email} onChange={e => setEmail(e.target.value)}
        />
        <input
          className="w-full border rounded p-2"
          type="password" placeholder="Mot de passe"
          value={password} onChange={e => setPassword(e.target.value)}
        />
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button className="w-full border rounded p-2" type="submit">
          Se connecter
        </button>
      </form>
    </main>
  );
}
