import "server-only";
import Stripe from "stripe";
import {
  RECHARGE_PACKAGES,
  type RechargePackageId,
} from "@/lib/recharge-packages";

export type StripeMode = "test" | "live";

let stripe: Stripe | null = null;

export function stripeMode(): StripeMode {
  return process.env.STRIPE_MODE === "live" ? "live" : "test";
}

function stripeSecretKey(mode = stripeMode()) {
  return process.env[`STRIPE_SECRET_KEY_${mode.toUpperCase()}`] || "";
}

export function stripeWebhookSecret(mode = stripeMode()) {
  return process.env[`STRIPE_WEBHOOK_SECRET_${mode.toUpperCase()}`] || "";
}

export function stripePriceId(packageId: RechargePackageId, mode = stripeMode()) {
  return process.env[
    `STRIPE_PRICE_${packageId.toUpperCase()}_${mode.toUpperCase()}`
  ] || "";
}

export function configuredStripePackage(
  packageId: RechargePackageId,
  mode = stripeMode(),
) {
  const pack = RECHARGE_PACKAGES[packageId];
  const priceId = stripePriceId(packageId, mode);
  if (!priceId.startsWith("price_")) {
    throw new Error(`Falta el precio Stripe de ${pack.name}.`);
  }
  return {
    ...pack,
    id: packageId,
    priceId,
    amountCents: pack.amount * 100,
    currency: "usd" as const,
    mode,
  };
}

export function packageForStripePrice(priceId: string, mode = stripeMode()) {
  return (Object.keys(RECHARGE_PACKAGES) as RechargePackageId[])
    .map((id) => configuredStripePackage(id, mode))
    .find((pack) => pack.priceId === priceId) || null;
}

export function isRechargePackageId(value: unknown): value is RechargePackageId {
  return typeof value === "string" && value in RECHARGE_PACKAGES;
}

export function createStripeClient() {
  const mode = stripeMode();
  const key = stripeSecretKey(mode);
  if (!key.startsWith(`rk_${mode}_`) && !key.startsWith(`sk_${mode}_`)) {
    throw new Error(`Stripe ${mode.toUpperCase()} todavía no está configurado.`);
  }
  if (!stripe) {
    stripe = new Stripe(key, {
      appInfo: { name: "AnaPau iA", version: "1.0.0" },
    });
  }
  return stripe;
}
