import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const CREDIT_COSTS = {
  chat_message: 3,
  voice_note: 2,
  creative_analysis_image: 60,
  creative_analysis_video: 120,
  meta_analysis: 120,
  static_brief: 15,
  static_generate_medium: 120,
  static_generate_high: 250,
  static_edit: 80,
  reference_analysis: 20,
} as const;

export type CreditModule = keyof typeof CREDIT_COSTS;
export class CreditError extends Error { constructor(public code: "insufficient_credits" | "daily_limit" | "rate_limit" | "monthly_limit" | "configuration", message: string) { super(message); } }

type ChargeInput = { userId: string; amount: number; reason: CreditModule; brandId?: string | null; provider: "openai" | "anthropic"; model: string; inputTokens?: number; outputTokens?: number; images?: number; costUsd?: number; route?: string };

export async function chargeCredits(input: ChargeInput) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is missing; credit charging is temporarily bypassed to keep the creative workspace available.");
    return { charged: false, amount: 0 };
  }
  if (await isUnlimited(admin, input.userId)) return { charged: false, amount: 0 };
  if (input.route) await enforceRequestLimit(admin, input.userId, input.route);
  const monthlyLimit = Number(process.env.MONTHLY_SPEND_LIMIT_USD || 300);
  const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const { data: monthRows } = await admin.from("credit_ledger").select("metadata").gte("created_at", start.toISOString());
  const monthCost = (monthRows || []).reduce((sum, row) => sum + Number((row.metadata as { cost_usd?: number } | null)?.cost_usd || 0), 0);
  if (monthCost >= monthlyLimit) throw new CreditError("monthly_limit", "La plataforma está en mantenimiento preventivo. Tus créditos no se descontaron.");
  const metadata = { module: input.reason, model: input.model, provider: input.provider, input_tokens: input.inputTokens || 0, output_tokens: input.outputTokens || 0, images: input.images || 0, cost_usd: input.costUsd || 0, brand_id: input.brandId || null };
  const { error } = await admin.rpc("spend_credits", { p_user_id: input.userId, p_amount: input.amount, p_reason: input.reason, p_metadata: metadata });
  if (error) {
    if (error.message.includes("insufficient_credits")) throw new CreditError("insufficient_credits", "No tienes créditos suficientes para esta acción. Recarga desde Cuenta para continuar.");
    if (error.message.includes("daily_credit_limit")) throw new CreditError("daily_limit", "Alcanzaste el límite diario de uso. Podrás continuar a partir de las 00:00 UTC.");
    console.error("credit charge failed", error);
    throw new CreditError("configuration", "No pudimos validar tus créditos. Intenta nuevamente.");
  }
  return { charged: true, amount: input.amount };
}

export async function refundCredits(userId: string, amount: number, reason: CreditModule, brandId?: string | null) {
  if (!amount) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.rpc("grant_credits", { p_user_id: userId, p_amount: amount, p_reason: "refund", p_metadata: { module: reason, brand_id: brandId || null, provider: "openai", model: "refund", input_tokens: 0, output_tokens: 0, images: 0, cost_usd: 0 } });
  if (error) console.error("credit refund failed", error);
}

export function creditErrorStatus(error: unknown) {
  if (!(error instanceof CreditError)) return 500;
  if (error.code === "insufficient_credits" || error.code === "daily_limit") return 402;
  if (error.code === "rate_limit") return 429;
  if (error.code === "monthly_limit") return 503;
  return 500;
}

async function isUnlimited(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userId: string) {
  const [{ data: profile }, { data: authUser }, { data: brand }] = await Promise.all([
    admin.from("profiles").select("role,email").eq("id", userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
    admin.from("brands").select("name").eq("owner_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const email = String(profile?.email || authUser.user?.email || "").toLowerCase();
  const allow = (process.env.UNLIMITED_CREDIT_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return profile?.role === "admin" || allow.includes(email) || brand?.name?.trim().toLowerCase() === "skinglow";
}

async function enforceRequestLimit(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userId: string, route: string) {
  const now = Date.now();
  const rules: Record<string, { max: number; ms: number }> = { chat: { max: 10, ms: 60_000 }, image: { max: 10, ms: 86_400_000 }, analysis: { max: 15, ms: 604_800_000 } };
  const rule = rules[route];
  if (!rule) return;
  const { count } = await admin.from("request_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("route", route).gte("created_at", new Date(now - rule.ms).toISOString());
  if ((count || 0) >= rule.max) throw new CreditError("rate_limit", "Llegaste al límite temporal de esta acción. Intenta nuevamente más tarde.");
  await admin.from("request_events").insert({ user_id: userId, route });
}
