export const PRICE_IDS = {
  BASIC:   process.env.STRIPE_PRICE_BASIC!,   // string requise
  PLUS:    process.env.STRIPE_PRICE_PLUS!,    // string requise
  PREMIUM: process.env.STRIPE_PRICE_PREMIUM!, // string requise
  CPLUS: {
    none: null,
    visio1: process.env.STRIPE_PRICE_CPLUS_VISIO1,
    real1:  process.env.STRIPE_PRICE_CPLUS_REAL1,
    real4:  process.env.STRIPE_PRICE_CPLUS_REAL4,
    real8:  process.env.STRIPE_PRICE_CPLUS_REAL8,
  },
} as const;
