// apps/web/lib/supabaseClient.ts
"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function readEnv(name: string): string | null {
  // 1) Valeur remplacée par Next au build (cas normal)
  const v = (process.env as any)[name];
  if (typeof v === "string" && v.length) return v;

  // 2) Fallback runtime injecté par le <script> dans layout.tsx
  if (typeof window !== "undefined" && (window as any).__env) {
    const wv = (window as any).__env[name];
    if (typeof wv === "string" && wv.length) return wv;
  }
  return null;
}

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !anon) {
    throw new Error(
      "Config Supabase manquante. Vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  client = createClient(url, anon);
  return client;
}
