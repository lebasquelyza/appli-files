--- a/app/dashboard/recipes/[id]/page.tsx
+++ b/app/dashboard/recipes/[id]/page.tsx
@@
 export const runtime = "nodejs";
 export const dynamic = "force-dynamic";
 export const revalidate = 0;
 
 type Plan = "BASIC" | "PLUS" | "PREMIUM";
@@
 export default async function Page({
   params,
   searchParams,
 }: {
   params: { id: string };
   searchParams?: { data?: string };
 }) {
-  const s: any = await getSession().catch(() => ({}));
+  const s: any = await getSession().catch(() => ({}));
   const plan: Plan = (s?.plan as Plan) || "BASIC";
@@
 }
