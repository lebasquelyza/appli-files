// apps/web/lib/supabaseAdmin.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error("Env NEXT_PUBLIC_SUPABASE_URL invalide (ex: https://xxx.supabase.co)");
  }
  if (!serviceKey) {
    throw new Error("Env SUPABASE_SERVICE_ROLE_KEY manquante");
  }

  _client = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  return _client;
}
