export const RECHARGE_PACKAGES = {
  impulso: { name: "Impulso", amount: 10, credits: 1000, note: "Para seguir creando después de la prueba." },
  crecimiento: { name: "Crecimiento", amount: 25, credits: 2700, note: "Para usar la plataforma varias veces por semana." },
  estudio: { name: "Estudio", amount: 50, credits: 5800, note: "Para producción creativa más constante." },
} as const;

export type RechargePackageId = keyof typeof RECHARGE_PACKAGES;
