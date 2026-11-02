import "server-only";
import { Types } from "mongoose";
import { connectDb } from "../db";
import { Client, type ClientDoc } from "../models/client";
import { Payment } from "../models/payment";
import type { StatusId } from "../clients/options";
import { HQ_TIMEZONE } from "../clients/list";
import { longDate, money } from "../clients/detail";
import { sendAlert } from "../health/notify";
import {
  periodEnd,
  stripe,
  subscriptionOfInvoice,
  type StripeCheckoutSession,
  type StripeInvoice,
  type StripePaymentMethod,
  type StripeSubscription,
} from "./stripe";

type Lean = Pick<ClientDoc, "_id" | "name" | "slug" | "subscription">;

const FIELDS = { name: 1, slug: 1, subscription: 1 } as const;

export const dayOfUnix = (seconds: number | null | undefined) =>
  seconds
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: HQ_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(seconds * 1000))
    : "";

const dateOf = (seconds: number | null | undefined) =>
  seconds ? new Date(seconds * 1000) : null;

async function findClient(ref: {
  clientId?: string | null;
  subscriptionId?: string | null;
  customerId?: string | null;
}): Promise<Lean | null> {
  await connectDb();
  if (ref.clientId && Types.ObjectId.isValid(ref.clientId)) {
    const byId = await Client.findById(ref.clientId, FIELDS).lean<Lean>();
    if (byId) return byId;
  }
  if (ref.subscriptionId) {
    const bySub = await Client.findOne(
      { "subscription.stripe.subscriptionId": ref.subscriptionId },
      FIELDS,
    ).lean<Lean>();
    if (bySub) return bySub;
  }
  if (ref.customerId)
    return Client.findOne(
      { "subscription.stripe.customerId": ref.customerId },
      FIELDS,
    ).lean<Lean>();
  return null;
}

function localStatus(sub: StripeSubscription, current: StatusId): StatusId {
  if (sub.status === "canceled" || sub.status === "incomplete_expired")
    return "cancelled";
  if (sub.status === "past_due" || sub.status === "unpaid") return "past_due";
  if (sub.pause_collection || sub.status === "paused") return "paused";
  if (sub.status === "trialing")
    return current === "trial" ? "trial" : "active";
  if (sub.status === "active") return "active";
  return current;
}

export async function fetchSubscription(id: string) {
  return stripe<StripeSubscription>("GET", `/subscriptions/${id}`, {
    expand: ["default_payment_method"],
  });
}

export async function applySubscription(
  sub: StripeSubscription,
): Promise<string | null> {
  const client = await findClient({
    clientId: sub.metadata?.clientId,
    subscriptionId: sub.id,
    customerId: sub.customer,
  });
  if (!client) {
    console.warn(`[billing] No client for Stripe subscription ${sub.id}`);
    return null;
  }

  const before = client.subscription.status;
  const toManual =
    sub.status === "canceled" && sub.metadata?.switchToManual === "1";
  const status = toManual
    ? before === "past_due" || before === "cancelled"
      ? "active"
      : before
    : localStatus(sub, before);
  const ended = status === "cancelled" || toManual;
  const end = periodEnd(sub);
  const card =
    typeof sub.default_payment_method === "object"
      ? (sub.default_payment_method as StripePaymentMethod | null)?.card
      : undefined;
  const nextBillingDate = toManual
    ? dayOfUnix(end)
    : ended || status === "paused" || sub.cancel_at_period_end
      ? ""
      : dayOfUnix(end);

  await Client.updateOne(
    { _id: client._id },
    {
      $set: {
        "subscription.status": status,
        "subscription.nextBillingDate": nextBillingDate,
        "subscription.billingMode": ended ? "manual" : "stripe",
        "subscription.paymentMethod": toManual ? "cash" : "card",
        "subscription.stripe.customerId": sub.customer,
        "subscription.stripe.subscriptionId": ended ? "" : sub.id,
        "subscription.stripe.status": sub.status,
        "subscription.stripe.currentPeriodEnd": dateOf(end),
        "subscription.stripe.cancelAtPeriodEnd": sub.cancel_at_period_end,
        "subscription.stripe.pausedAt": sub.pause_collection
          ? (client.subscription.stripe?.pausedAt ?? new Date())
          : null,
        "subscription.stripe.resumesAt": dateOf(
          sub.pause_collection?.resumes_at,
        ),
        "subscription.stripe.checkoutUrl": "",
        "subscription.stripe.checkoutExpiresAt": null,
        "subscription.stripe.syncedAt": new Date(),
        ...(status !== "past_due" && {
          "subscription.stripe.lastPaymentError": "",
        }),
        ...(card && {
          "subscription.stripe.card": {
            brand: card.brand,
            last4: card.last4,
            expMonth: card.exp_month,
            expYear: card.exp_year,
          },
        }),
      },
    },
  );

  if (before !== status && status === "cancelled" && !toManual)
    await sendAlert({
      tone: "info",
      label: "Billing",
      title: `${client.name}: subscription ended`,
      lines: [
        "Their automatic card billing stopped. They're now cancelled in HQ.",
      ],
      path: `/clients/${client.slug}`,
    });
  return client.slug;
}

export async function syncSubscription(id: string) {
  return applySubscription(await fetchSubscription(id));
}

export async function completeCheckout(session: StripeCheckoutSession) {
  if (session.mode === "setup") return adoptNewCard(session);
  if (session.mode !== "subscription" || !session.subscription) return;
  const client = await findClient({
    clientId: session.client_reference_id ?? session.metadata?.clientId,
    customerId: session.customer,
  });
  if (!client) return;
  await Client.updateOne(
    { _id: client._id },
    {
      $set: {
        "subscription.billingMode": "stripe",
        "subscription.stripe.customerId": session.customer ?? "",
        "subscription.stripe.subscriptionId": session.subscription,
      },
    },
  );
  await syncSubscription(session.subscription);
  await sendAlert({
    tone: "up",
    label: "Billing",
    title: `${client.name} added their card`,
    lines: [
      "Automatic billing is on. Stripe charges them every cycle from now on.",
    ],
    path: `/clients/${client.slug}`,
  });
}

export async function recordPaidInvoice(invoice: StripeInvoice) {
  const subscriptionId = subscriptionOfInvoice(invoice);
  const client = await findClient({
    subscriptionId,
    customerId: invoice.customer,
  });
  if (!client) return;

  if (invoice.amount_paid > 0) {
    const line = invoice.lines?.data[0]?.period;
    const currency = invoice.currency.toUpperCase();
    const result = await Payment.updateOne(
      { stripeInvoiceId: invoice.id },
      {
        $setOnInsert: {
          client: client._id,
          slug: client.slug,
          clientName: client.name,
          source: "stripe",
          kind: "subscription",
          status: "paid",
          amountCents: invoice.amount_paid,
          currency: currency === "LBP" ? "LBP" : "USD",
          paidAt: dateOf(invoice.status_transitions?.paid_at) ?? new Date(),
          periodStart: dayOfUnix(line?.start ?? invoice.period_start),
          periodEnd: dayOfUnix(line?.end ?? invoice.period_end),
          method: "card",
          invoiceNumber: invoice.number ?? "",
          invoiceUrl: invoice.hosted_invoice_url ?? "",
          receiptUrl: invoice.invoice_pdf ?? "",
          recordedBy: "stripe",
        },
      },
      { upsert: true },
    );
    if (result.upsertedCount > 0)
      await sendAlert({
        tone: "up",
        label: "Billing",
        title: `${client.name} paid ${money(invoice.amount_paid / 100, currency)}`,
        lines: [
          `Charged by Stripe${invoice.number ? `, invoice ${invoice.number}` : ""}.`,
        ],
        path: `/clients/${client.slug}`,
      });
  }
  if (subscriptionId) await syncSubscription(subscriptionId);
}

export async function recordFailedInvoice(invoice: StripeInvoice) {
  const subscriptionId = subscriptionOfInvoice(invoice);
  const client = await findClient({
    subscriptionId,
    customerId: invoice.customer,
  });
  if (!client) return;

  const retry = invoice.next_payment_attempt
    ? `Stripe tries again on ${longDate(dayOfUnix(invoice.next_payment_attempt))}.`
    : "Stripe won't retry it automatically.";
  const reason =
    invoice.last_finalization_error?.message ?? "The card was declined.";

  await Client.updateOne(
    { _id: client._id },
    { $set: { "subscription.stripe.lastPaymentError": `${reason} ${retry}` } },
  );
  if (subscriptionId) await syncSubscription(subscriptionId);

  await sendAlert({
    tone: "warning",
    label: "Billing",
    title: `${client.name}: payment failed`,
    lines: [
      `${money(invoice.amount_due / 100, invoice.currency.toUpperCase())} couldn't be charged (attempt ${invoice.attempt_count}).`,
      retry,
      ...(invoice.hosted_invoice_url
        ? [`They can pay it here: ${invoice.hosted_invoice_url}`]
        : []),
    ],
    path: `/clients/${client.slug}`,
  });
}

async function adoptNewCard(session: StripeCheckoutSession) {
  if (!session.setup_intent || !session.customer) return;
  const intent = await stripe<{ payment_method: string | null }>(
    "GET",
    `/setup_intents/${session.setup_intent}`,
  );
  if (!intent.payment_method) return;
  const subscriptionId = session.metadata?.subscriptionId;
  await stripe("POST", `/customers/${session.customer}`, {
    invoice_settings: { default_payment_method: intent.payment_method },
  });
  if (!subscriptionId) return;
  await stripe("POST", `/subscriptions/${subscriptionId}`, {
    default_payment_method: intent.payment_method,
  });

  const open = await stripe<{ data: { id: string }[] }>("GET", "/invoices", {
    subscription: subscriptionId,
    status: "open",
    limit: 5,
  });
  for (const invoice of open.data) {
    try {
      await stripe("POST", `/invoices/${invoice.id}/pay`, {
        payment_method: intent.payment_method,
      });
    } catch (error) {
      console.warn(`[billing] Retrying invoice ${invoice.id} failed:`, error);
    }
  }
  await syncSubscription(subscriptionId);
}
