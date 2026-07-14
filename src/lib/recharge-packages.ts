export const RECHARGE_PACKAGES = {
  impulso: { name: "Impulso", amount: 10, credits: 1000, note: "Para probar y crear piezas puntuales." },
  crecimiento: { name: "Crecimiento", amount: 25, credits: 2800, note: "Incluye 12% de créditos extra." },
  estudio: { name: "Estudio", amount: 50, credits: 6000, note: "Incluye 20% de créditos extra para producción continua." },
} as const;

export type RechargePackageId = keyof typeof RECHARGE_PACKAGES;
