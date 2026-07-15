import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type ProviderStatus =
  | "operational"
  | "quota_exhausted"
  | "rate_limited"
  | "invalid_key"
  | "degraded"
  | "unconfigured";

type ProviderHealth = {
  id: "openai" | "anthropic";
  label: string;
  status: ProviderStatus;
  message: string;
  keyFingerprint: string | null;
  expectedFingerprint: string | null;
  keyMatchesExpected: boolean | null;
  model: string;
  checkedAt: string;
  latencyMs: number;
  officialMonthSpendUsd: number | null;
  configuredCreditUsd: number | null;
  estimatedBalanceUsd: number | null;
  adminReportingEnabled: boolean;
  consoleUrl: string;
};

export async function GET() {
  const context = await getAdminContext();
  if (!context)
    return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });

  const providers = await Promise.all([checkOpenAI(), checkAnthropic()]);
  return NextResponse.json(
    { providers, checkedAt: new Date().toISOString() },
    { headers: { "cache-control": "private, no-store, max-age=0" } },
  );
}

async function checkOpenAI(): Promise<ProviderHealth> {
  const key = process.env.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
  const expectedSuffix = cleanSuffix(process.env.OPENAI_EXPECTED_KEY_SUFFIX);
  const startedAt = Date.now();
  const base = providerBase({
    id: "openai",
    label: "OpenAI",
    key,
    expectedSuffix,
    model,
    startedAt,
    configuredCreditUsd: optionalUsd(process.env.OPENAI_CREDIT_TOTAL_USD),
    adminReportingEnabled: Boolean(process.env.OPENAI_ADMIN_KEY),
    consoleUrl: "https://platform.openai.com/settings/organization/billing",
  });
  if (!key)
    return {
      ...base,
      status: "unconfigured",
      message: "No hay una llave de producción configurada.",
    };

  const [health, officialMonthSpendUsd] = await Promise.all([
    probeOpenAI(key, model),
    getOpenAIMonthSpend(process.env.OPENAI_ADMIN_KEY),
  ]);
  return finalizeFinancials(
    { ...base, ...health, latencyMs: Date.now() - startedAt },
    officialMonthSpendUsd,
  );
}

async function checkAnthropic(): Promise<ProviderHealth> {
  const key = process.env.ANTHROPIC_API_KEY || "";
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const expectedSuffix = cleanSuffix(process.env.ANTHROPIC_EXPECTED_KEY_SUFFIX);
  const startedAt = Date.now();
  const base = providerBase({
    id: "anthropic",
    label: "Anthropic",
    key,
    expectedSuffix,
    model,
    startedAt,
    configuredCreditUsd: optionalUsd(process.env.ANTHROPIC_CREDIT_TOTAL_USD),
    adminReportingEnabled: Boolean(process.env.ANTHROPIC_ADMIN_KEY),
    consoleUrl: "https://console.anthropic.com/settings/billing",
  });
  if (!key)
    return {
      ...base,
      status: "unconfigured",
      message: "No hay una llave de producción configurada.",
    };

  const [health, officialMonthSpendUsd] = await Promise.all([
    probeAnthropic(key, model),
    getAnthropicMonthSpend(process.env.ANTHROPIC_ADMIN_KEY),
  ]);
  return finalizeFinancials(
    { ...base, ...health, latencyMs: Date.now() - startedAt },
    officialMonthSpendUsd,
  );
}

function providerBase(input: {
  id: "openai" | "anthropic";
  label: string;
  key: string;
  expectedSuffix: string | null;
  model: string;
  startedAt: number;
  configuredCreditUsd: number | null;
  adminReportingEnabled: boolean;
  consoleUrl: string;
}): ProviderHealth {
  return {
    id: input.id,
    label: input.label,
    status: "degraded",
    message: "Comprobación pendiente.",
    keyFingerprint: input.key ? maskKey(input.key) : null,
    expectedFingerprint: input.expectedSuffix
      ? `…${input.expectedSuffix}`
      : null,
    keyMatchesExpected:
      input.key && input.expectedSuffix
        ? input.key.endsWith(input.expectedSuffix)
        : null,
    model: input.model,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - input.startedAt,
    officialMonthSpendUsd: null,
    configuredCreditUsd: input.configuredCreditUsd,
    estimatedBalanceUsd: null,
    adminReportingEnabled: input.adminReportingEnabled,
    consoleUrl: input.consoleUrl,
  };
}

async function probeOpenAI(key: string, model: string) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "Responde OK." }],
      }),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (response.ok)
      return {
        status: "operational" as const,
        message: "Cuota disponible y modelo respondiendo.",
      };
    return classifyProviderError(response.status, await response.text());
  } catch (error) {
    return {
      status: "degraded" as const,
      message:
        error instanceof Error && error.name === "TimeoutError"
          ? "El proveedor no respondió dentro de 12 segundos."
          : "No se pudo conectar con el proveedor.",
    };
  }
}

async function probeAnthropic(key: string, model: string) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "Responde OK." }],
      }),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (response.ok)
      return {
        status: "operational" as const,
        message: "Cuota disponible y modelo respondiendo.",
      };
    return classifyProviderError(response.status, await response.text());
  } catch (error) {
    return {
      status: "degraded" as const,
      message:
        error instanceof Error && error.name === "TimeoutError"
          ? "El proveedor no respondió dentro de 12 segundos."
          : "No se pudo conectar con el proveedor.",
    };
  }
}

function classifyProviderError(status: number, body: string) {
  const normalized = body.toLowerCase();
  if (
    normalized.includes("insufficient_quota") ||
    normalized.includes("credit balance") ||
    normalized.includes("billing") ||
    normalized.includes("exceeded your current quota")
  )
    return {
      status: "quota_exhausted" as const,
      message: "Sin cuota utilizable. Revisa saldo, facturación y límites.",
    };
  if (status === 401 || status === 403)
    return {
      status: "invalid_key" as const,
      message: "La llave fue rechazada o no tiene permisos.",
    };
  if (status === 429)
    return {
      status: "rate_limited" as const,
      message: "Límite temporal alcanzado; la llave sí fue reconocida.",
    };
  return {
    status: "degraded" as const,
    message: `El modelo rechazó la prueba de salud (HTTP ${status}).`,
  };
}

async function getOpenAIMonthSpend(adminKey?: string) {
  if (!adminKey) return null;
  const startTime = monthStartUnix();
  try {
    const response = await fetch(
      `https://api.openai.com/v1/organization/costs?start_time=${startTime}&limit=31`,
      {
        headers: { authorization: `Bearer ${adminKey}` },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      data?: Array<{
        results?: Array<{ amount?: { value?: number; currency?: string } }>;
      }>;
    };
    return roundUsd(
      (payload.data || []).flatMap((bucket) => bucket.results || []).reduce(
        (sum, item) => sum + Number(item.amount?.value || 0),
        0,
      ),
    );
  } catch {
    return null;
  }
}

async function getAnthropicMonthSpend(adminKey?: string) {
  if (!adminKey) return null;
  const startingAt = new Date();
  startingAt.setUTCDate(1);
  startingAt.setUTCHours(0, 0, 0, 0);
  const query = new URLSearchParams({
    starting_at: startingAt.toISOString(),
    bucket_width: "1d",
    limit: "31",
  });
  try {
    const response = await fetch(
      `https://api.anthropic.com/v1/organizations/cost_report?${query}`,
      {
        headers: {
          "x-api-key": adminKey,
          "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      data?: Array<{ results?: Array<{ amount?: string }> }>;
    };
    const cents = (payload.data || [])
      .flatMap((bucket) => bucket.results || [])
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return roundUsd(cents / 100);
  } catch {
    return null;
  }
}

function finalizeFinancials(
  provider: ProviderHealth,
  officialMonthSpendUsd: number | null,
) {
  const estimatedBalanceUsd =
    provider.configuredCreditUsd !== null && officialMonthSpendUsd !== null
      ? roundUsd(
          Math.max(provider.configuredCreditUsd - officialMonthSpendUsd, 0),
        )
      : null;
  return { ...provider, officialMonthSpendUsd, estimatedBalanceUsd };
}

function maskKey(key: string) {
  const prefix = key.startsWith("sk-proj-")
    ? "sk-proj-"
    : key.startsWith("sk-ant-")
      ? "sk-ant-"
      : key.slice(0, Math.min(3, key.length));
  return `${prefix}…${key.slice(-4)}`;
}

function cleanSuffix(value?: string) {
  const suffix = value?.trim();
  return suffix ? suffix.slice(-8) : null;
}

function optionalUsd(value?: string) {
  if (!value?.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function monthStartUnix() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

function roundUsd(value: number) {
  return Number(value.toFixed(4));
}
