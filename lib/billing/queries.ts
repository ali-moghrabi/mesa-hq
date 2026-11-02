import "server-only";
import { Types } from "mongoose";
import { connectDb } from "../db";
import { Client } from "../models/client";
import { Payment, type PaymentDoc } from "../models/payment";
import { cycleOf } from "../clients/options";
import { todayIn } from "../clients/list";
import { stripeConfigured, stripeTestMode } from "./stripe";

export type PaymentRow = {
  id: string;
  slug: string;
  clientName: string;
  source: PaymentDoc["source"];
  kind: PaymentDoc["kind"];
  amount: number;
  currency: string;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  method: string;
  note: string;
  invoiceNumber: string;
  invoiceUrl: string;
  recordedBy: string;
};

const toRow = (p: PaymentDoc): PaymentRow => ({
  id: String(p._id),
  slug: p.slug,
  clientName: p.clientName,
  source: p.source,
  kind: p.kind,
  amount: p.amountCents / 100,
  currency: p.currency,
  paidAt: new Date(p.paidAt).toISOString(),
  periodStart: p.periodStart ?? "",
  periodEnd: p.periodEnd ?? "",
  method: p.method ?? "",
  note: p.note ?? "",
  invoiceNumber: p.invoiceNumber ?? "",
  invoiceUrl: p.invoiceUrl ?? "",
  recordedBy: p.recordedBy ?? "",
});

export async function clientPayments(
  clientId: string,
  limit = 24,
): Promise<{
  rows: PaymentRow[];
  totals: { currency: string; amount: number }[];
}> {
  await connectDb();
  const id = new Types.ObjectId(clientId);
  const [docs, totals] = await Promise.all([
    Payment.find({ client: id })
      .sort({ paidAt: -1 })
      .limit(limit)
      .lean<PaymentDoc[]>(),
    Payment.aggregate<{ _id: string; cents: number }>([
      { $match: { client: id, status: "paid" } },
      { $group: { _id: "$currency", cents: { $sum: "$amountCents" } } },
    ]),
  ]);
  return {
    rows: docs.map(toRow),
    totals: totals.map((t) => ({ currency: t._id, amount: t.cents / 100 })),
  };
}

export async function countBillingAlerts(): Promise<number> {
  await connectDb();
  return Client.countDocuments({
    isDemo: { $ne: true },
    $or: [
      { "subscription.status": "past_due" },
      {
        "subscription.status": "active",
        "subscription.billingMode": { $ne: "stripe" },
        "subscription.nextBillingDate": { $gt: "", $lt: todayIn() },
      },
    ],
  });
}

export type DueRow = {
  slug: string;
  name: string;
  status: string;
  billingMode: string;
  nextBillingDate: string;
  amount: number;
  currency: string;
  cycle: string;
  error: string;
  card: string;
};

export type BillingOverview = {
  stripe: { configured: boolean; test: boolean; webhook: boolean };
  mrr: { currency: string; amount: number }[];
  collected30: { currency: string; amount: number }[];
  counts: {
    automatic: number;
    manual: number;
    failing: number;
    paused: number;
    overdue: number;
  };
  failing: DueRow[];
  overdue: DueRow[];
  upcoming: DueRow[];
  recent: PaymentRow[];
};

type LeanClient = {
  slug: string;
  name: string;
  subscription: {
    status: string;
    billingMode?: string;
    nextBillingDate?: string;
    monthlyPriceCents: number;
    currency: string;
    cycle: string;
    stripe?: {
      lastPaymentError?: string;
      card?: { brand?: string; last4?: string };
    };
  };
};

const toDue = (c: LeanClient): DueRow => ({
  slug: c.slug,
  name: c.name,
  status: c.subscription.status,
  billingMode: c.subscription.billingMode ?? "manual",
  nextBillingDate: c.subscription.nextBillingDate ?? "",
  amount:
    (c.subscription.monthlyPriceCents *
      cycleOf(c.subscription.cycle).paidMonths) /
    100,
  currency: c.subscription.currency,
  cycle: c.subscription.cycle,
  error: c.subscription.stripe?.lastPaymentError ?? "",
  card: c.subscription.stripe?.card?.last4
    ? `${c.subscription.stripe.card.brand} ·${c.subscription.stripe.card.last4}`
    : "",
});

export async function billingOverview(): Promise<BillingOverview> {
  await connectDb();
  const today = todayIn();
  const soon = todayIn(undefined, 14);
  const since = new Date(Date.now() - 30 * 86_400_000);
  const real = { isDemo: { $ne: true } };
  const fields = { slug: 1, name: 1, subscription: 1 };

  const [clients, recent, collected] = await Promise.all([
    Client.find(
      { ...real, "subscription.status": { $ne: "cancelled" } },
      fields,
    ).lean<LeanClient[]>(),
    Payment.find({}).sort({ paidAt: -1 }).limit(25).lean<PaymentDoc[]>(),
    Payment.aggregate<{ _id: string; cents: number }>([
      { $match: { status: "paid", paidAt: { $gte: since } } },
      { $group: { _id: "$currency", cents: { $sum: "$amountCents" } } },
    ]),
  ]);

  const mrr = new Map<string, number>();
  for (const c of clients) {
    if (!["active", "past_due"].includes(c.subscription.status)) continue;
    const cycle = cycleOf(c.subscription.cycle);
    const monthly =
      (c.subscription.monthlyPriceCents * cycle.paidMonths) / cycle.months;
    mrr.set(
      c.subscription.currency,
      (mrr.get(c.subscription.currency) ?? 0) + monthly,
    );
  }

  const billed = (c: LeanClient) =>
    ["active", "trial", "past_due"].includes(c.subscription.status);
  const failing = clients.filter((c) => c.subscription.status === "past_due");
  const overdue = clients.filter(
    (c) =>
      billed(c) &&
      c.subscription.billingMode !== "stripe" &&
      !!c.subscription.nextBillingDate &&
      c.subscription.nextBillingDate < today,
  );
  const upcoming = clients
    .filter(
      (c) =>
        billed(c) &&
        c.subscription.status !== "past_due" &&
        !!c.subscription.nextBillingDate &&
        c.subscription.nextBillingDate >= today &&
        c.subscription.nextBillingDate <= soon,
    )
    .sort((a, b) =>
      (a.subscription.nextBillingDate ?? "").localeCompare(
        b.subscription.nextBillingDate ?? "",
      ),
    );

  const byCurrency = (
    m: Map<string, number> | { _id: string; cents: number }[],
  ) =>
    (m instanceof Map
      ? [...m].map(([currency, cents]) => ({ currency, cents }))
      : m.map((x) => ({ currency: x._id, cents: x.cents }))
    )
      .map((x) => ({ currency: x.currency, amount: Math.round(x.cents) / 100 }))
      .sort((a, b) =>
        a.currency === "USD" ? -1 : b.currency === "USD" ? 1 : 0,
      );

  return {
    stripe: {
      configured: stripeConfigured(),
      test: stripeTestMode(),
      webhook: !!process.env.STRIPE_WEBHOOK_SECRET,
    },
    mrr: byCurrency(mrr),
    collected30: byCurrency(collected),
    counts: {
      automatic: clients.filter(
        (c) => c.subscription.billingMode === "stripe" && billed(c),
      ).length,
      manual: clients.filter(
        (c) => c.subscription.billingMode !== "stripe" && billed(c),
      ).length,
      failing: failing.length,
      paused: clients.filter((c) => c.subscription.status === "paused").length,
      overdue: overdue.length,
    },
    failing: failing.map(toDue),
    overdue: overdue
      .map(toDue)
      .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate)),
    upcoming: upcoming.map(toDue),
    recent: recent.map(toRow),
  };
}
