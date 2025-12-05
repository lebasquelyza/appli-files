// apps/web/lib/supabase.ts
"use client";

import { createClient } from "@supabase/supabase-js";

// Ce client est destiné au BROWSER (composants client).
// NE L’IMPORTE PAS dans vos routes API/serveur.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon);
