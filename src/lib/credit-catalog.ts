export const CREDIT_USD_VALUE = 0.01;
export const INITIAL_INCLUDED_CREDITS = 600;
export const INITIAL_INCLUDED_USD = INITIAL_INCLUDED_CREDITS * CREDIT_USD_VALUE;
export const TRIAL_REAL_COST_LIMIT_USD = 3;

export type CreditCatalogItem = {
  module: string;
  label: string;
  description: string;
  credits: number;
  estimatedCostUsd: number;
  category: "chat" | "analysis" | "image" | "account";
};

export const CREDIT_CATALOG = [
  {
    module: "chat_message",
    label: "Chat ligero",
    description: "Pregunta estratégica frecuente dentro del chat.",
    credits: 1,
    estimatedCostUsd: 0.002,
    category: "chat",
  },
  {
    module: "voice_note",
    label: "Nota de voz",
    description: "Transcripción de audio para convertirlo en texto utilizable.",
    credits: 2,
    estimatedCostUsd: 0.006,
    category: "chat",
  },
  {
    module: "creative_analysis_image",
    label: "Análisis de imagen",
    description: "Diagnóstico creativo de un estático o imagen publicitaria.",
    credits: 8,
    estimatedCostUsd: 0.007,
    category: "analysis",
  },
  {
    module: "creative_analysis_video",
    label: "Análisis de video",
    description: "Lectura de guion, frames y aprendizajes de un video.",
    credits: 18,
    estimatedCostUsd: 0.025,
    category: "analysis",
  },
  {
    module: "creative_analysis_script",
    label: "Guion",
    description: "Analizar, mejorar o generar un guion listo para grabar.",
    credits: 5,
    estimatedCostUsd: 0.004,
    category: "analysis",
  },
  {
    module: "meta_analysis",
    label: "Análisis Meta",
    description: "Procesar export de Meta Ads y convertirlo en aprendizajes.",
    credits: 12,
    estimatedCostUsd: 0.007,
    category: "analysis",
  },
  {
    module: "static_brief",
    label: "Ficha creativa",
    description: "Dirección estratégica antes de crear una imagen.",
    credits: 4,
    estimatedCostUsd: 0.005,
    category: "image",
  },
  {
    module: "static_generate_medium",
    label: "Imagen estándar",
    description: "Generación de una imagen publicitaria en calidad estándar.",
    credits: 35,
    estimatedCostUsd: 0.07,
    category: "image",
  },
  {
    module: "static_generate_high",
    label: "Imagen alta",
    description: "Generación de una imagen publicitaria en calidad alta.",
    credits: 80,
    estimatedCostUsd: 0.19,
    category: "image",
  },
  {
    module: "static_edit",
    label: "Corrección de imagen",
    description: "Edición o corrección de un estático generado.",
    credits: 30,
    estimatedCostUsd: 0.07,
    category: "image",
  },
  {
    module: "reference_analysis",
    label: "Referencia visual",
    description: "Lectura de una imagen de referencia para guiar dirección visual.",
    credits: 4,
    estimatedCostUsd: 0.002,
    category: "analysis",
  },
] as const satisfies readonly CreditCatalogItem[];

export type CreditModule = (typeof CREDIT_CATALOG)[number]["module"];

export const CREDIT_COSTS = Object.fromEntries(
  CREDIT_CATALOG.map((item) => [item.module, item.credits]),
) as Record<CreditModule, number>;

export const CREDIT_LABELS = Object.fromEntries(
  CREDIT_CATALOG.map((item) => [item.module, item.label]),
) as Record<CreditModule, string>;

export function creditPriceUsd(credits: number) {
  return Number((credits * CREDIT_USD_VALUE).toFixed(2));
}

export function estimatedGrossProfitUsd(credits: number, estimatedCostUsd: number) {
  return Number((creditPriceUsd(credits) - estimatedCostUsd).toFixed(3));
}

export function estimatedGrossMargin(credits: number, estimatedCostUsd: number) {
  const price = creditPriceUsd(credits);
  return price > 0 ? Math.round(((price - estimatedCostUsd) / price) * 100) : 0;
}

export function catalogItem(module: string) {
  return CREDIT_CATALOG.find((item) => item.module === module);
}
