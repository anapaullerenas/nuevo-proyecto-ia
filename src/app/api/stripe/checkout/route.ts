import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  configuredStripePackage,
  createStripeClient,
  isRechargePackageId,
  stripeMode,
  stripeWebhookSecret,
} from "@/lib/stripe";

export const runtime = "nodejs";

function hasValidOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json({ error: "El pago está temporalmente en mantenimiento." }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para comprar créditos." }, { status: 401 });
  }

  const idempotencyKey = request.headers.get("idempotency-key") || "";
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return NextResponse.json({ error: "Solicitud de pago inválida." }, { status: 400 });
  }

  try {
    const body = await request.json();
    if (!isRechargePackageId(body?.package)) {
      return NextResponse.json({ error: "Elige un paquete válido." }, { status: 400 });
    }
    if (!stripeWebhookSecret().startsWith("whsec_")) {
      return NextResponse.json({ error: "La confirmación de Stripe aún no está configurada." }, { status: 503 });
    }

    const pack = configuredStripePackage(body.package);
    const stripe = createStripeClient();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, "");
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      line_items: [{ price: pack.priceId, quantity: 1 }],
      metadata: { user_id: user.id, package_id: pack.id },
      success_url: `${appUrl}/cuenta?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cuenta?payment=cancelled`,
      locale: "es",
    }, { idempotencyKey: `${user.id}:${idempotencyKey}` });

    if (!checkout.url) throw new Error("Stripe no devolvió la página de pago.");

    const { error } = await admin.from("stripe_checkout_sessions").upsert({
      id: checkout.id,
      user_id: user.id,
      package_id: pack.id,
      price_id: pack.priceId,
      credits: pack.credits,
      amount_total: pack.amountCents,
      currency: pack.currency,
      stripe_mode: stripeMode(),
      status: "created",
    }, { onConflict: "id", ignoreDuplicates: true });

    if (error) {
      await stripe.checkout.sessions.expire(checkout.id).catch(() => undefined);
      console.error("stripe checkout registration failed", error);
      throw new Error("No pudimos registrar el pago.");
    }

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos abrir Stripe.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
