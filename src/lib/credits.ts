import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasUnlimitedAccessEmail } from "@/lib/auth/access-exceptions";
import { CREDIT_COSTS, type CreditModule } from "@/lib/credit-catalog";

export { CREDIT_COSTS };
export type { CreditModule };
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

export async function authorizeCredits(input: ChargeInput) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new CreditError(
      "configuration",
      "No pudimos validar tus créditos. Intenta nuevamente en unos minutos.",
    );
  }
  if (await isUnlimited(admin, input.userId)) return { authorized: true };
  if (input.route) await enforceRequestLimit(admin, input.userId, input.route);
  await enforcePlatformSpendLimit(admin);

  await preflightCredits(admin, input);
  return { authorized: true };
}

export async function chargeCredits(input: ChargeInput) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is missing; credit charging is unavailable.");
    throw new CreditError(
      "configuration",
      "No pudimos validar tus créditos. Intenta nuevamente en unos minutos.",
    );
  }
  if (await isUnlimited(admin, input.userId))
    return { charged: false, amount: 0, operationId: null };
  if (input.route) await enforceRequestLimit(admin, input.userId, input.route);
  await enforcePlatformSpendLimit(admin);
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
  if (error) throwCreditRpcError(error.message);
  return { charged: true, amount: input.amount, operationId };
}

function throwCreditRpcError(message: string): never {
  if (message.includes("insufficient_credits"))
    throw new CreditError(
      "insufficient_credits",
      "Ya usaste el saldo incluido o no tienes créditos suficientes para esta acción. Recarga desde Cuenta para continuar.",
    );
  if (message.includes("daily_credit_limit"))
    throw new CreditError(
      "daily_limit",
      "Alcanzaste el límite diario de uso. Podrás continuar a partir de las 00:00 UTC.",
    );
  console.error("credit validation failed", message);
  throw new CreditError(
    "configuration",
    "No pudimos validar tus créditos. Intenta nuevamente.",
  );
}

async function enforcePlatformSpendLimit(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
) {
  const monthlyLimit = Number(process.env.MONTHLY_SPEND_LIMIT_USD || 300);
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data: monthRows, error } = await admin
    .from("credit_ledger")
    .select("metadata")
    .gte("created_at", start.toISOString());
  if (error) {
    console.error("monthly credit cost check failed", error);
    throw new CreditError(
      "configuration",
      "No pudimos validar el límite de uso. Intenta nuevamente en unos minutos.",
    );
  }
  const monthCost = (monthRows || []).reduce(
    (sum, row) =>
      sum + Number((row.metadata as { cost_usd?: number } | null)?.cost_usd || 0),
    0,
  );
  if (monthCost >= monthlyLimit)
    throw new CreditError(
      "monthly_limit",
      "La plataforma está en mantenimiento preventivo. Tus créditos no se descontaron.",
    );
}

async function preflightCredits(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  input: ChargeInput,
) {
  const { data: periodStart, error: periodError } = await admin.rpc(
    "current_credit_period_start",
    { p_user_id: input.userId },
  );
  if (periodError || !periodStart) {
    console.error("credit period preflight failed", periodError);
    throw new CreditError(
      "configuration",
      "No pudimos validar tus créditos. Intenta nuevamente.",
    );
  }

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [walletResult, dailyResult, periodResult] = await Promise.all([
      admin
        .from("credit_wallets")
        .select("balance,monthly_allowance,allowance_used,allowance_reset_at")
        .eq("user_id", input.userId)
        .maybeSingle(),
      admin
        .from("credit_ledger")
        .select("amount")
        .eq("user_id", input.userId)
        .lt("amount", 0)
        .gte("created_at", dayStart.toISOString()),
      admin
        .from("credit_ledger")
        .select("amount,metadata")
        .eq("user_id", input.userId)
        .lt("amount", 0)
        .gte("created_at", `${periodStart}T00:00:00.000Z`),
    ]);
  if (walletResult.error || dailyResult.error || periodResult.error) {
    console.error("credit balance preflight failed", {
      wallet: walletResult.error,
      daily: dailyResult.error,
      period: periodResult.error,
    });
    throw new CreditError(
      "configuration",
      "No pudimos validar tus créditos. Intenta nuevamente.",
    );
  }
  const wallet = walletResult.data;
  const dailyRows = dailyResult.data;
  const periodRows = periodResult.data;

  const spentToday = (dailyRows || []).reduce(
    (sum, row) => sum + Math.abs(Number(row.amount || 0)),
    0,
  );
  if (spentToday + input.amount > 800)
    throwCreditRpcError("daily_credit_limit");

  const periodWasReset =
    !wallet?.allowance_reset_at ||
    String(wallet.allowance_reset_at).slice(0, 10) < String(periodStart);
  let allowanceAvailable = periodWasReset
    ? 600
    : Math.max(600 - Number(wallet?.allowance_used || 0), 0);
  const trialCost = (periodRows || []).reduce((sum, row) => {
    const metadata = row.metadata as {
      allowance_spent?: number;
      cost_usd?: number;
    } | null;
    return (
      sum +
      (Number(metadata?.allowance_spent || 0) > 0
        ? Number(metadata?.cost_usd || 0)
        : 0)
    );
  }, 0);
  if (trialCost >= 3 || trialCost + Number(input.costUsd || 0) > 3)
    allowanceAvailable = 0;

  const totalAvailable =
    allowanceAvailable + Math.max(Number(wallet?.balance || 0), 0);
  if (totalAvailable < input.amount)
    throwCreditRpcError("insufficient_credits");
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
    chat: { max: 20, ms: 60_000 },
    image: { max: 20, ms: 10 * 60_000 },
    analysis: { max: 20, ms: 60 * 60_000 },
  };
  const rule = rules[route];
  if (!rule) return;
  const { count, error: countError } = await admin
    .from("request_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("route", route)
    .gte("created_at", new Date(now - rule.ms).toISOString());
  if (countError) {
    console.error("request limit check failed", countError);
    throw new CreditError(
      "configuration",
      "No pudimos validar el límite de uso. Intenta nuevamente en unos minutos.",
    );
  }
  if ((count || 0) >= rule.max)
    throw new CreditError(
      "rate_limit",
      route === "image"
        ? "Hay demasiadas generaciones seguidas. Espera 10 minutos e intenta nuevamente; tus créditos no se descontaron."
        : "Hay demasiadas solicitudes seguidas. Espera unos minutos e intenta nuevamente; tus créditos no se descontaron.",
    );
  const { error: insertError } = await admin
    .from("request_events")
    .insert({ user_id: userId, route });
  if (insertError) {
    console.error("request event insert failed", insertError);
    throw new CreditError(
      "configuration",
      "No pudimos registrar esta acción. Intenta nuevamente en unos minutos.",
    );
  }
}
