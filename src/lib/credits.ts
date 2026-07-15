import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasUnlimitedAccessEmail } from "@/lib/auth/access-exceptions";

export const CREDIT_COSTS = {
  chat_message: 3,
  voice_note: 2,
  creative_analysis_image: 60,
  creative_analysis_video: 120,
  creative_analysis_script: 40,
  meta_analysis: 120,
  static_brief: 15,
  static_generate_medium: 120,
  static_generate_high: 250,
  static_edit: 80,
  reference_analysis: 20,
} as const;

export type CreditModule = keyof typeof CREDIT_COSTS;
export class CreditError extends Error {
  constructor(
    public code:
      | "insufficient_credits"
      | "daily_limit"
      | "rate_limit"
      | "monthly_limit"
      | "configuration",
    message: string,
  ) {
    super(message);
  }
}

type ChargeInput = {
  userId: string;
  amount: number;
  reason: CreditModule;
  brandId?: string | null;
  provider: "openai" | "anthropic";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  images?: number;
  costUsd?: number;
  route?: string;
};

export async function chargeCredits(input: ChargeInput) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY is missing; credit charging is temporarily bypassed to keep the creative workspace available.",
    );
    return { charged: false, amount: 0, operationId: null };
  }
  if (await isUnlimited(admin, input.userId))
    return { charged: false, amount: 0, operationId: null };
  if (input.route) await enforceRequestLimit(admin, input.userId, input.route);
  const monthlyLimit = Number(process.env.MONTHLY_SPEND_LIMIT_USD || 300);
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data: monthRows } = await admin
    .from("credit_ledger")
    .select("metadata")
    .gte("created_at", start.toISOString());
  const monthCost = (monthRows || []).reduce(
    (sum, row) =>
      sum +
      Number((row.metadata as { cost_usd?: number } | null)?.cost_usd || 0),
    0,
  );
  if (monthCost >= monthlyLimit)
    throw new CreditError(
      "monthly_limit",
      "La plataforma está en mantenimiento preventivo. Tus créditos no se descontaron.",
    );
  const operationId = crypto.randomUUID();
  const metadata = {
    module: input.reason,
    operation_id: operationId,
    model: input.model,
    provider: input.provider,
    input_tokens: input.inputTokens || 0,
    output_tokens: input.outputTokens || 0,
    images: input.images || 0,
    cost_usd: input.costUsd || 0,
    brand_id: input.brandId || null,
  };
  const { error } = await admin.rpc("spend_credits", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_reason: input.reason,
    p_metadata: metadata,
  });
  if (error) {
    if (error.message.includes("insufficient_credits"))
      throw new CreditError(
        "insufficient_credits",
        "No tienes créditos suficientes para esta acción. Recarga desde Cuenta para continuar.",
      );
    if (error.message.includes("daily_credit_limit"))
      throw new CreditError(
        "daily_limit",
        "Alcanzaste el límite diario de uso. Podrás continuar a partir de las 00:00 UTC.",
      );
    console.error("credit charge failed", error);
    throw new CreditError(
      "configuration",
      "No pudimos validar tus créditos. Intenta nuevamente.",
    );
  }
  return { charged: true, amount: input.amount, operationId };
}

export async function refundCredits(
  userId: string,
  amount: number,
  reason: CreditModule,
  brandId?: string | null,
  operationId?: string | null,
) {
  if (!amount) return true;
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  if (operationId) {
    const { error } = await admin.rpc("refund_credit_charge", {
      p_user_id: userId,
      p_operation_id: operationId,
    });
    if (!error) return true;
    console.error("transactional credit refund failed", error);
    return false;
  }
  const { error } = await admin.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: "refund",
    p_metadata: {
      module: reason,
      refund_of: operationId || null,
      brand_id: brandId || null,
      provider: "openai",
      model: "refund",
      input_tokens: 0,
      output_tokens: 0,
      images: 0,
      cost_usd: 0,
    },
  });
  if (error) {
    console.error("credit refund failed", error);
    return false;
  }
  return true;
}

export function creditErrorStatus(error: unknown) {
  if (!(error instanceof CreditError)) return 500;
  if (error.code === "insufficient_credits" || error.code === "daily_limit")
    return 402;
  if (error.code === "rate_limit") return 429;
  if (error.code === "monthly_limit") return 503;
  return 500;
}

async function isUnlimited(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userId: string,
) {
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin.from("profiles").select("role,email").eq("id", userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);
  const email = String(
    profile?.email || authUser.user?.email || "",
  ).toLowerCase();
  const allow = (process.env.UNLIMITED_CREDIT_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return (
    profile?.role === "admin" ||
    hasUnlimitedAccessEmail(email) ||
    allow.includes(email)
  );
}

async function enforceRequestLimit(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userId: string,
  route: string,
) {
  const now = Date.now();
  const rules: Record<string, { max: number; ms: number }> = {
    chat: { max: 10, ms: 60_000 },
    image: { max: 10, ms: 86_400_000 },
    analysis: { max: 15, ms: 604_800_000 },
  };
  const rule = rules[route];
  if (!rule) return;
  const { count } = await admin
    .from("request_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("route", route)
    .gte("created_at", new Date(now - rule.ms).toISOString());
  if ((count || 0) >= rule.max)
    throw new CreditError(
      "rate_limit",
      "Llegaste al límite temporal de esta acción. Intenta nuevamente más tarde.",
    );
  await admin.from("request_events").insert({ user_id: userId, route });
}
