// apps/web/app/dashboard/motivation/notifications/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type NotificationRow = {
  id: string;
  user_email: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  source: string | null;
  rating: number | null;
};

// Pour être sûr que Next ne le pré-génère pas statiquement
export const dynamic = "force-dynamic";

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "[motivation/notifications] Supabase non configuré (NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant)"
    );
    return null;
  }

  return createClient(url, serviceRoleKey);
}

export async function GET(req: Request) {
  // 👉 Essaye d'instancier Supabase
  const supabase = getSupabaseServer();

  // Si pas configuré = on renvoie juste une liste vide
  if (!supabase) {
    return NextResponse.json<NotificationRow[]>([]);
  }

  // ⚠️ À adapter plus tard : ici on retournera les "vraies" notifications
  // Pour l’instant, on renvoie aussi [] pour ne pas bloquer
  return NextResponse.json<NotificationRow[]>([]);
}
