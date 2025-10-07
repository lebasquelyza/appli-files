// apps/web/lib/price-map.ts
export const PRICE_IDS = {
  BASIC:    "price_basic_monthly_XXX",
  PLUS:     "price_plus_monthly_XXX",
  PREMIUM:  "price_premium_monthly_XXX",

  CPLUS: {
    none:   null,                         // pas d'item additionnel
    visio1: "price_cplus_visio1_XXX",
    real1:  "price_cplus_real1_XXX",
    real4:  "price_cplus_real4_XXX",
    real8:  "price_cplus_real8_XXX",
  },
} as const;
