import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createStripeClient,
  packageForStripePrice,
  stripeMode,
  stripeWebhookSecret,
} from "@/lib/stripe";

export const runtime = "nodejs";

async function markCheckout(
  sessionId: string,
  status: "failed" | "expired",
  eventId: string,
) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase no está configurado.");
  const { error } = await admin
    .from("stripe_checkout_sessions")
    .update({ status, stripe_event_id: eventId, updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
}

async function creditPaidSession(event: Stripe.Event, session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;
  if (!session.client_reference_id || session.client_reference_id !== session.metadata?.user_id) {
    throw new Error("La sesión pagada no contiene un usuario válido.");
  }
  if (session.currency !== "usd" || session.amount_total === null) {
    throw new Error("La moneda o el importe no son válidos.");
  }

  const stripe = createStripeClient();
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
  if (lineItems.data.length !== 1 || lineItems.data[0].quantity !== 1) {
    throw new Error("La sesión no contiene exactamente un paquete.");
  }
  const priceId = lineItems.data[0].price?.id;
  if (!priceId) throw new Error("La sesión no contiene un Price ID.");
  const pack = packageForStripePrice(priceId);
  if (!pack || pack.id !== session.metadata?.package_id) {
    throw new Error("El paquete pagado no coincide con el catálogo permitido.");
  }
  if (session.amount_total !== pack.amountCents) {
    throw new Error("El importe pagado no coincide con el paquete.");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase no está configurado.");
  const { error } = await admin.rpc("apply_stripe_credit_purchase", {
    p_user_id: session.client_reference_id,
    p_stripe_event_id: event.id,
    p_checkout_session_id: session.id,
    p_price_id: priceId,
    p_credits: pack.credits,
    p_amount_total: session.amount_total,
    p_currency: session.currency,
  });
  if (error) throw error;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = stripeWebhookSecret();
  if (!signature || !secret.startsWith("whsec_")) {
    return NextResponse.json({ error: "Firma de webhook ausente." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = createStripeClient().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return NextResponse.json({ error: "Firma de webhook inválida." }, { status: 400 });
  }

  try {
    const session = event.data.object as Stripe.Checkout.Session;
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await creditPaidSession(event, session);
        break;
      case "checkout.session.async_payment_failed":
        await markCheckout(session.id, "failed", event.id);
        break;
      case "checkout.session.expired":
        await markCheckout(session.id, "expired", event.id);
        break;
      default:
        break;
    }
    return NextResponse.json({ received: true, mode: stripeMode() });
  } catch (error) {
    console.error("stripe webhook processing failed", error);
    return NextResponse.json({ error: "No pudimos aplicar el evento." }, { status: 500 });
  }
}
