--- a/app/dashboard/recipes/page.tsx
+++ b/app/dashboard/recipes/page.tsx
@@
 export const runtime = "nodejs";
 export const dynamic = "force-dynamic";
 export const revalidate = 0;
@@
 async function applyFiltersAction(formData: FormData): Promise<void> {
   "use server";
-  const s = await getSession();
-  const plan: Plan = (s?.plan as Plan) || "BASIC";
+  const s = await getSession().catch(() => ({}));
+  const plan: Plan = (s?.plan as Plan) || "BASIC";
 
   const params = new URLSearchParams();
   const fields = ["kcal","kcalMin","kcalMax","allergens","diets"] as const;
   for (const f of fields) {
     const val = (formData.get(f) ?? "").toString().trim();
     if (val) params.set(f, val);
   }
   // Ajoute un rnd pour fixer le seed (évite tout décalage d'hydratation)
   params.set("rnd", String(Date.now()));
 
-  if (plan === "BASIC") redirect("/dashboard/abonnement");
-
   redirect(`/dashboard/recipes?${params.toString()}`);
 }
@@
 export default async function Page({
   searchParams,
 }: {
   searchParams?: { f?: string; kcal?: string; kcalMin?: string; kcalMax?: string; allergens?: string; diets?: string; rnd?: string };
 }) {
-  const s = await getSession();
+  const s = await getSession().catch(() => ({}));
   const plan: Plan = (s?.plan as Plan) || "BASIC";
   const goals = normalizeGoals(s);
@@
   const available = aiRecipes.filter((r) => isUnlocked(r, plan));
   // seed stable par défaut (pas de Date.now() ici) ; rnd vient de l'URL
   const seed = Number(searchParams?.rnd ?? "0") || 123456789;
   const recommended = pickRandomSeeded(available, 6, seed);
@@
   return (
     <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
       <PageHeader title="Recettes personnalisées" subtitle="Générées par IA selon votre formule, objectifs et contraintes" />
@@
       <Section title="Recommandé pour vous (IA)">
-        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
-          {recommended.map((r) => {
-            const detailQS = encode(r);
-            return <RecommendedCard key={r.id} r={r} detailQS={detailQS} userPlan={plan} />;
-          })}
-        </div>
+        {recommended.length > 0 ? (
+          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
+            {recommended.map((r) => {
+              const detailQS = encode(r);
+              return <RecommendedCard key={r.id} r={r} detailQS={detailQS} userPlan={plan} />;
+            })}
+          </div>
+        ) : (
+          <div className="card">
+            <h3 style={{ margin: 0 }}>Aucune recette disponible</h3>
+            <p className="text-sm" style={{ color: "#6b7280" }}>
+              Aucun résultat ne correspond à vos filtres ou à votre formule. Essayez de
+              <a href="/dashboard/recipes" className="link" style={{ marginLeft: 6 }}>réinitialiser les filtres</a>
+              {plan !== "PREMIUM" && <> ou <a href="/dashboard/abonnement" className="link">mettre à niveau</a></>}.
+            </p>
+          </div>
+        )}
       </Section>
     </div>
   );
 }
