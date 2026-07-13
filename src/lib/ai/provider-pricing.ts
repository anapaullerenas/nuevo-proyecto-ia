export const PROVIDER_PRICING = {
  openai: {
    "gpt-4.1": { inputPerMillion: 2, outputPerMillion: 8 },
    "gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6 },
    "gpt-image-2-medium": { perImage: 0.07 },
    "gpt-image-2-high": { perImage: 0.19 },
    "gpt-4o-mini-transcribe": { perMinute: 0.003 },
  },
  anthropic: {
    "claude-sonnet-5": { inputPerMillion: 3, outputPerMillion: 15 },
  },
} as const;

export function estimateCostUsd({ provider, model, inputTokens = 0, outputTokens = 0, images = 0, minutes = 0 }: { provider: "openai" | "anthropic"; model: string; inputTokens?: number; outputTokens?: number; images?: number; minutes?: number }) {
  const table = PROVIDER_PRICING[provider] as Record<string, { inputPerMillion?: number; outputPerMillion?: number; perImage?: number; perMinute?: number }>;
  const price = table[model] || {};
  return Number(((inputTokens / 1_000_000) * (price.inputPerMillion || 0) + (outputTokens / 1_000_000) * (price.outputPerMillion || 0) + images * (price.perImage || 0) + minutes * (price.perMinute || 0)).toFixed(6));
}
