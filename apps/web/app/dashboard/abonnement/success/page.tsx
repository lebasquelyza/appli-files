// apps/web/app/dashboard/abonnement/success/page.tsx
import { stripe } from "@/lib/stripe";
import { cookies } from "next/headers";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SuccessPage({
  searchParams,
}: { searchParams?: { session_id?: string } }) {
  const sid = searchParams?.session_id;
  if (!sid) {
    return (
      <div>
        <h1>Paiement</h1>
        <p>Session Stripe introuvable.</p>
        <Link href="/dashboard/abonnement">Retour</Link>
      </div>
    );
  }

  // Récupérer la session Stripe en toute sécurité (server component)
  const session = await stripe.checkout.sessions.retrieve(sid, {
    expand: ["line_items.data.price.product", "customer", "subscription"],
  });

  // Vérifier l'état (selon Stripe : payment_status "paid" ou status "complete")
  const paidOrComplete =
    session.payment_status === "paid" || session.status === "complete";

  if (!paidOrComplete) {
    return (
      <div>
        <h1>Paiement en cours</h1>
        <p>Le paiement n’est pas encore confirmé. Réessayez dans quelques instants.</p>
        <Link href="/dashboard/abonnement">Retour</Link>
      </div>
    );
  }

  // Lire ce qu'on a passé en metadata lors de la création de la session
  const plan = (session.metadata?.plan || "BASIC") as "BASIC" | "PLUS" | "PREMIUM";
  const option = (session.metadata?.option || "none") as string;

  // Montant total (si tu veux l’afficher)
  const totalEUR = Number(((session.amount_total ?? 0) / 100).toFixed(2));

  // Mettre à jour ta "app_session" minimale (cookie) pour l’accès dans l’app
  const now = new Date();
  const nextPaymentAt = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const expiresAt = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const updated = {
    plan,
    coachingOption: option,
    stripeCustomerId:
      typeof session.customer === "string" ? session.customer : session.customer?.id,
    stripeSubscriptionId:
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id,
    monthlyTotalEUR: totalEUR,
    nextPaymentAt: nextPaymentAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastUpdatedAt: now.toISOString(),
  };

  cookies().set("app_session", JSON.stringify(updated), { path: "/" });

  return (
    <div>
      <h1>Abonnement activé</h1>
      <p>Merci ! Votre accès premium est maintenant actif.</p>
      <p>Total mensuel : {totalEUR.toFixed(2)} €</p>
      <Link href="/dashboard/abonnement">Retour à l’abonnement</Link>
    </div>
  );
}
