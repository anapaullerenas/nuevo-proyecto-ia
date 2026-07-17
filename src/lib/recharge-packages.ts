export const RECHARGE_PACKAGES = {
  impulso: { name: "Impulso", amount: 10, credits: 500, note: "Para seguir creando después de la prueba." },
  crecimiento: { name: "Crecimiento", amount: 25, credits: 1500, note: "Para usar la plataforma varias veces por semana." },
  estudio: { name: "Estudio", amount: 50, credits: 3500, note: "Para producción creativa más constante." },
} as const;

export type RechargePackageId = keyof typeof RECHARGE_PACKAGES;
