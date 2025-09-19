import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

/** Client Supabase côté serveur, créé à la première demande (jamais au top-level). */
export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  if (!url || !key) {
    const missing: string[] = [];
    if (!url) missing.push("SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL");
    if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY");
    throw Object.assign(new Error("Supabase env missing: " + missing.join(", ")), { status: 500 });
  }

  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}
// apps/web/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon);
