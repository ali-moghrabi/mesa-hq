import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { StripeEvent } from "@/lib/models/payment";
import {
  verifyWebhook,
  type StripeCheckoutSession,
  type StripeInvoice,
  type StripeSubscription,
} from "@/lib/billing/stripe";
import {
  applySubscription,
  completeCheckout,
  recordFailedInvoice,
  recordPaidInvoice,
  syncSubscription,
} from "@/lib/billing/sync";

/*
 * Stripe → HQ. Add this endpoint in the Stripe dashboard (Developers → Webhooks):
 *   https://<your HQ>/api/stripe/webhook
 * with these events:
 *   checkout.session.completed
 *   customer.subscription.created, .updated, .deleted, .paused, .resumed
 *   invoice.paid, invoice.payment_failed
 * and put its signing secret in STRIPE_WEBHOOK_SECRET.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Event = { id: string; type: string; data: { object: unknown } };

export async function POST(request: NextRequest) {
  const payload = await request.text();
  if (
    !verifyWebhook(
      payload,
      request.headers.get("stripe-signature"),
      process.env.STRIPE_WEBHOOK_SECRET ?? "",
    )
  )
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });

  let event: Event;
  try {
    event = JSON.parse(payload) as Event;
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  await connectDb();
  try {
    await StripeEvent.create({ _id: event.id, type: event.type });
  } catch (error) {
    if ((error as { code?: number }).code === 11000)
      return NextResponse.json({ received: true, duplicate: true });
    throw error;
  }

  try {
    const object = event.data.object;
    switch (event.type) {
      case "checkout.session.completed":
        await completeCheckout(object as StripeCheckoutSession);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await syncSubscription((object as StripeSubscription).id);
        break;
      case "customer.subscription.deleted":
        // it's gone: the event's copy is the last word
        await applySubscription(object as StripeSubscription);
        break;
      case "invoice.paid":
        await recordPaidInvoice(object as StripeInvoice);
        break;
      case "invoice.payment_failed":
        await recordFailedInvoice(object as StripeInvoice);
        break;
    }
  } catch (error) {
    await StripeEvent.deleteOne({ _id: event.id });
    console.error(`[billing] Webhook ${event.type} failed:`, error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
