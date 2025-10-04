// apps/web/lib/supabaseClient.ts
"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Empêche la création d'un client invalide (cause fréquente de crash runtime)
  if (!url || !anon) {
    throw new Error(
      "Config Supabase manquante. Vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL invalide: ${url}`);
  }

  client = createClient(url, anon);
  return client;
}
