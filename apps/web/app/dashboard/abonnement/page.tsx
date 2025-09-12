// apps/web/app/dashboard/abonnement/page.tsx
import { redirect } from "next/navigation";
export default function Page(){ redirect("/dashboard/pricing"); }
export const dynamic = "force-dynamic";
