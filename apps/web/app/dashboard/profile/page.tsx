// apps/web/app/dashboard/profile/page.tsx
import { cookies } from "next/headers";
import ProfileClient from "./ProfileClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getLang(): "fr" | "en" {
  const cookieLang = cookies().get("fc-lang")?.value;
  return cookieLang === "en" ? "en" : "fr";
}

export default async function Page() {
  const lang = getLang();
  return <ProfileClient lang={lang} />;
}
