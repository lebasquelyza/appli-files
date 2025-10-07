// apps/web/lib/price-map.ts
import "server-only";

/**
 * On lit les IDs de prix Stripe (LIVE) depuis les variables d'environnement.
 * Avantages :
 * - pas besoin de re-deployer si tu changes un price_id
 * - pas de fuite d'IDs en code
 *
 * À définir côté env :
 *  STRIPE_PRICE_BASIC
 *  STRIPE_PRICE_PLUS
 *  STRIPE_PRICE_PREMIUM
 *  STRIPE_PRICE_CPLUS_VISIO1   (optionnel)
 *  STRIPE_PRICE_CPLUS_REAL1    (optionnel)
 *  STRIPE_PRICE_CPLUS_REAL4    (optionnel)
 *  STRIPE_PRICE_CPLUS_REAL8    (optionnel)
 *
 * Tous doivent être du format "price_...".
 */

function readPrice(name: string, required = true): string | null {
  const v = process.env[name];
  if (!v) {
    if (required) {
      // On laisse la server action faire une validation propre et afficher un message
      return "" as unknown as string;
    }
    return null;
  }
  return v;
}

export const PRICE_IDS = {
  // Abonnements mensuels (LIVE)
  BASIC:   readPrice("STRIPE_PRICE_BASIC"),   // 9,90 €/mois
  PLUS:    readPrice("STRIPE_PRICE_PLUS"),    // 19,90 €/mois
  PREMIUM: readPrice("STRIPE_PRICE_PREMIUM"), // 39,90 €/mois

  // Options Coaching+ (LIVE) – mensuelles (facultatives)
  CPLUS: {
    none:   null,
    visio1: readPrice("STRIPE_PRICE_CPLUS_VISIO1", false), // +20 €
    real1:  readPrice("STRIPE_PRICE_CPLUS_REAL1",  false), // +40 €
    real4:  readPrice("STRIPE_PRICE_CPLUS_REAL4",  false), // +140 €
    real8:  readPrice("STRIPE_PRICE_CPLUS_REAL8",  false), // +240 €
  },
} as const;
