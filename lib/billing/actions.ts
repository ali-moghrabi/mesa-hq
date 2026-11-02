"use server";

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../auth/session";
import { connectDb } from "../db";
import { Client, type ClientDoc } from "../models/client";
import { Payment } from "../models/payment";
import { cycleOf, PAYMENT_METHOD_IDS } from "../clients/options";
import { HQ_TIMEZONE, todayIn } from "../clients/list";
import { longDate, planName } from "../clients/detail";
import { nextBillingAfter } from "../clients/schema";
import {
  stripe,
  StripeError,
  type StripeCheckoutSession,
  type StripeSubscription,
} from "./stripe";
import { applySubscription, syncSubscription } from "./sync";

export type BillingState =
  | { ok?: boolean; message?: string; url?: string; expiresAt?: string }
  | undefined;

type Doc = Pick<
  ClientDoc,
  "_id" | "name" | "slug" | "contact" | "subscription"
>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function load(slug: string): Promise<Doc | null> {
  await connectDb();
  return Client.findOne(
    { slug },
    { name: 1, slug: 1, contact: 1, subscription: 1 },
  ).lean<Doc>();
}

const done = (slug: string, message: string, extra: BillingState = {}) => {
  revalidatePath(`/clients/${slug}`);
  revalidatePath("/clients");
  revalidatePath("/billing");
  return { ok: true, message, ...extra };
};

const failed = (error: unknown): BillingState => {
  if (error instanceof StripeError) return { message: error.message };
  console.error("[billing]", error);
  return { message: "Something went wrong. Try again in a moment." };
};

const hqUrl = () =>
  (process.env.HQ_URL ?? "").replace(/\/+$/, "") || "http://localhost:3100";

function noonIn(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const utcNoon = Date.UTC(y, m - 1, d, 12);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: HQ_TIMEZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(utcNoon))
      .map((p) => [p.type, Number(p.value)]),
  );
  const shown = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  return Math.round((utcNoon - (shown - utcNoon)) / 1000);
}

const isAutomatic = (c: Doc) =>
  c.subscription.billingMode === "stripe" &&
  !!c.subscription.stripe?.subscriptionId;

const cycleCents = (c: Doc) =>
  Math.round(
    c.subscription.monthlyPriceCents * cycleOf(c.subscription.cycle).paidMonths,
  );

async function ensureCustomer(c: Doc): Promise<string> {
  if (c.subscription.stripe?.customerId)
    return c.subscription.stripe.customerId;
  const customer = await stripe<{ id: string }>(
    "POST",
    "/customers",
    {
      name: c.name,
      email: c.contact.email,
      phone: c.contact.phone || undefined,
      metadata: { clientId: String(c._id), slug: c.slug },
    },
    { idempotencyKey: `hq-customer-${c._id}` },
  );
  await Client.updateOne(
    { _id: c._id },
    { $set: { "subscription.stripe.customerId": customer.id } },
  );
  return customer.id;
}

export async function createCardLink(slug: string): Promise<BillingState> {
  await requireAdmin(["owner"]);
  const c = await load(slug);
  if (!c) return { message: "This client no longer exists." };
  if (isAutomatic(c))
    return { message: "Automatic billing is already on for this client." };
  const sub = c.subscription;
  if (sub.status === "cancelled")
    return { message: "Set the client back to Active first (Edit)." };
  const amount = cycleCents(c);
  if (amount <= 0) return { message: "Set a price first (Edit → Plan)." };

  const cycle = cycleOf(sub.cycle);
  const today = todayIn();
  const firstCharge =
    sub.nextBillingDate && DAY.test(sub.nextBillingDate)
      ? sub.nextBillingDate
      : today;
  const waitUntil = noonIn(firstCharge);
  const canWait = waitUntil > Date.now() / 1000 + 49 * 3600;

  try {
    const old = sub.stripe?.checkoutUrl?.match(/\/(cs_[A-Za-z0-9_]+)/)?.[1];
    if (old)
      await stripe("POST", `/checkout/sessions/${old}/expire`).catch(() => {});

    const customer = await ensureCustomer(c);
    const session = await stripe<StripeCheckoutSession>(
      "POST",
      "/checkout/sessions",
      {
        mode: "subscription",
        customer,
        client_reference_id: String(c._id),
        payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: sub.currency.toLowerCase(),
              unit_amount: amount,
              recurring: {
                interval: cycle.interval,
                interval_count: cycle.intervalCount,
              },
              product_data: {
                name: `MESA ${planName(sub.plan)} plan`,
                description: `${c.name}: website, hosting and support`,
              },
            },
          },
        ],
        subscription_data: {
          description: `${c.name} · MESA ${planName(sub.plan)}, billed every ${cycle.every}`,
          metadata: { clientId: String(c._id), slug: c.slug },
          ...(canWait && { trial_end: waitUntil }),
        },
        metadata: { clientId: String(c._id), slug: c.slug },
        custom_text: {
          submit: {
            message: canWait
              ? `Your card is saved now and first charged on ${longDate(firstCharge)}, then every ${cycle.every}. You can ask us to pause or cancel at any time.`
              : `Your card is charged now, then every ${cycle.every}. You can ask us to pause or cancel at any time.`,
          },
        },
        success_url: `${hqUrl()}/billing/done?ok=1`,
        cancel_url: `${hqUrl()}/billing/done`,
      },
    );
    if (!session.url)
      return { message: "Stripe didn't return a link. Try again." };

    const expiresAt = new Date(session.expires_at * 1000);
    await Client.updateOne(
      { _id: c._id },
      {
        $set: {
          "subscription.stripe.checkoutUrl": session.url,
          "subscription.stripe.checkoutExpiresAt": expiresAt,
        },
      },
    );
    return done(slug, "Link ready. Send it to the client.", {
      url: session.url,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return failed(error);
  }
}

export async function createCardUpdateLink(
  slug: string,
): Promise<BillingState> {
  await requireAdmin(["owner"]);
  const c = await load(slug);
  if (!c || !isAutomatic(c))
    return { message: "Automatic billing isn't on for this client." };
  try {
    const session = await stripe<StripeCheckoutSession>(
      "POST",
      "/checkout/sessions",
      {
        mode: "setup",
        customer: c.subscription.stripe.customerId,
        client_reference_id: String(c._id),
        payment_method_types: ["card"],
        metadata: {
          clientId: String(c._id),
          slug: c.slug,
          subscriptionId: c.subscription.stripe.subscriptionId,
        },
        success_url: `${hqUrl()}/billing/done?ok=1`,
        cancel_url: `${hqUrl()}/billing/done`,
      },
    );
    if (!session.url)
      return { message: "Stripe didn't return a link. Try again." };
    return done(slug, "Link ready. Send it to the client.", {
      url: session.url,
      expiresAt: new Date(session.expires_at * 1000).toISOString(),
    });
  } catch (error) {
    return failed(error);
  }
}

export async function pauseBilling(
  slug: string,
  _previous: BillingState,
  form: FormData,
): Promise<BillingState> {
  await requireAdmin(["owner"]);
  const c = await load(slug);
  if (!c) return { message: "This client no longer exists." };
  const resumeOn = String(form.get("resumeOn") ?? "");
  if (resumeOn && (!DAY.test(resumeOn) || resumeOn <= todayIn()))
    return { message: "Pick a resume date after today, or leave it empty." };

  try {
    if (isAutomatic(c)) {
      await stripe(
        "POST",
        `/subscriptions/${c.subscription.stripe.subscriptionId}`,
        {
          pause_collection: {
            behavior: "void",
            ...(resumeOn && { resumes_at: noonIn(resumeOn) }),
          },
        },
      );
      await syncSubscription(c.subscription.stripe.subscriptionId);
    } else {
      await Client.updateOne(
        { _id: c._id },
        {
          $set: {
            "subscription.status": "paused",
            "subscription.nextBillingDate": "",
            "subscription.stripe.resumesAt": resumeOn
              ? new Date(`${resumeOn}T12:00:00Z`)
              : null,
          },
        },
      );
    }
    return done(
      slug,
      resumeOn
        ? `Paused. Billing starts again on ${longDate(resumeOn)}.`
        : "Paused. Nothing is charged until you resume.",
    );
  } catch (error) {
    return failed(error);
  }
}

export async function resumeBilling(slug: string): Promise<BillingState> {
  await requireAdmin(["owner"]);
  const c = await load(slug);
  if (!c) return { message: "This client no longer exists." };
  try {
    if (isAutomatic(c)) {
      await stripe(
        "POST",
        `/subscriptions/${c.subscription.stripe.subscriptionId}`,
        {
          pause_collection: null,
        },
      );
      await syncSubscription(c.subscription.stripe.subscriptionId);
    } else {
      await Client.updateOne(
        { _id: c._id },
        {
          $set: {
            "subscription.status": "active",
            "subscription.nextBillingDate": todayIn(),
            "subscription.stripe.resumesAt": null,
          },
        },
      );
    }
    return done(slug, "Billing is back on.");
  } catch (error) {
    return failed(error);
  }
}

export async function cancelBilling(
  slug: string,
  _previous: BillingState,
  form: FormData,
): Promise<BillingState> {
  await requireAdmin(["owner"]);
  const c = await load(slug);
  if (!c) return { message: "This client no longer exists." };
  const when = String(form.get("when") ?? "end");

  try {
    if (isAutomatic(c)) {
      const id = c.subscription.stripe.subscriptionId;
      if (when === "end") {
        await stripe("POST", `/subscriptions/${id}`, {
          cancel_at_period_end: true,
        });
        await syncSubscription(id);
        return done(
          slug,
          "Cancelled at the end of the paid period. Nothing more is charged.",
        );
      }
      if (when === "manual") {
        await stripe("POST", `/subscriptions/${id}`, {
          metadata: { switchToManual: "1" },
        });
        const sub = await stripe<StripeSubscription>(
          "DELETE",
          `/subscriptions/${id}`,
        );
        await applySubscription(sub);
        return done(
          slug,
          "Automatic billing is off. They're billed by hand from now on.",
        );
      }
      const sub = await stripe<StripeSubscription>(
        "DELETE",
        `/subscriptions/${id}`,
      );
      await applySubscription(sub);
      return done(slug, "Cancelled now. Nothing more is charged.");
    }

    await Client.updateOne(
      { _id: c._id },
      {
        $set: {
          "subscription.status": "cancelled",
          "subscription.nextBillingDate": "",
        },
      },
    );
    return done(slug, "Cancelled.");
  } catch (error) {
    return failed(error);
  }
}

export async function undoCancel(slug: string): Promise<BillingState> {
  await requireAdmin(["owner"]);
  const c = await load(slug);
  if (!c || !isAutomatic(c)) return { message: "Automatic billing isn't on." };
  try {
    await stripe(
      "POST",
      `/subscriptions/${c.subscription.stripe.subscriptionId}`,
      {
        cancel_at_period_end: false,
      },
    );
    await syncSubscription(c.subscription.stripe.subscriptionId);
    return done(slug, "They'll keep being billed as before.");
  } catch (error) {
    return failed(error);
  }
}

/** Reads the subscription from Stripe again (if a webhook went missing) */
export async function refreshBilling(slug: string): Promise<BillingState> {
  await requireAdmin(["owner"]);
  const c = await load(slug);
  if (!c || !isAutomatic(c)) return { message: "Automatic billing isn't on." };
  try {
    await syncSubscription(c.subscription.stripe.subscriptionId);
    return done(slug, "Up to date with Stripe.");
  } catch (error) {
    return failed(error);
  }
}

/* ───────────── manual payments ───────────── */

export async function recordPayment(
  slug: string,
  _previous: BillingState,
  form: FormData,
): Promise<BillingState> {
  const me = await requireAdmin(["owner"]);
  const c = await load(slug);
  if (!c) return { message: "This client no longer exists." };

  const amount = Number(String(form.get("amount") ?? "").replace(",", "."));
  const paidOn = String(form.get("paidOn") ?? "");
  const method = String(form.get("method") ?? "cash");
  const kind = form.get("kind") === "setup" ? "setup" : "subscription";
  const note = String(form.get("note") ?? "")
    .trim()
    .slice(0, 300);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000)
    return { message: "Enter the amount they paid." };
  if (!DAY.test(paidOn) || paidOn > todayIn())
    return { message: "Pick the day they paid (today or before)." };
  if (!(PAYMENT_METHOD_IDS as readonly string[]).includes(method))
    return { message: "Pick how they paid." };

  const sub = c.subscription;
  const from =
    sub.nextBillingDate && DAY.test(sub.nextBillingDate)
      ? sub.nextBillingDate
      : paidOn;
  const covers =
    kind === "subscription"
      ? nextBillingAfter(from, sub.billingDay, sub.cycle)
      : "";

  await Payment.create({
    client: c._id,
    slug: c.slug,
    clientName: c.name,
    source: "manual",
    kind,
    amountCents: Math.round(amount * 100),
    currency: sub.currency,
    paidAt: new Date(`${paidOn}T12:00:00Z`),
    periodStart: kind === "subscription" ? from : "",
    periodEnd: covers,
    method,
    note,
    recordedBy: me.email,
  });

  if (kind === "setup")
    await Client.updateOne(
      { _id: c._id },
      { $set: { "subscription.setupPaid": true } },
    );
  // a manual client's next payment moves one cycle forward (automatic ones follow Stripe)
  else if (
    !isAutomatic(c) &&
    ["active", "trial", "past_due"].includes(sub.status)
  )
    await Client.updateOne(
      { _id: c._id },
      {
        $set: {
          "subscription.nextBillingDate": covers,
          "subscription.status": "active",
        },
      },
    );

  return done(
    slug,
    kind === "setup"
      ? "Setup fee recorded as paid."
      : isAutomatic(c)
        ? "Payment recorded."
        : `Payment recorded. Next payment: ${longDate(covers)}.`,
  );
}

/** The quick "setup fee paid" switch */
export async function setSetupPaid(
  slug: string,
  paid: boolean,
): Promise<BillingState> {
  const me = await requireAdmin(["owner"]);
  const c = await load(slug);
  if (!c) return { message: "This client no longer exists." };
  await Client.updateOne(
    { _id: c._id },
    { $set: { "subscription.setupPaid": paid } },
  );
  if (paid && c.subscription.setupFeeCents > 0)
    await Payment.create({
      client: c._id,
      slug: c.slug,
      clientName: c.name,
      source: "manual",
      kind: "setup",
      amountCents: c.subscription.setupFeeCents,
      currency: c.subscription.currency,
      paidAt: new Date(),
      method:
        c.subscription.paymentMethod === "card"
          ? "cash"
          : c.subscription.paymentMethod,
      note: "Setup fee",
      recordedBy: me.email,
    });
  // switched off by mistake: the payment that switch added goes too
  if (!paid)
    await Payment.deleteMany({
      client: c._id,
      source: "manual",
      kind: "setup",
      note: "Setup fee",
    });
  return done(
    slug,
    paid ? "Setup fee marked as paid." : "Setup fee marked as not paid.",
  );
}

export async function deletePayment(
  slug: string,
  paymentId: string,
): Promise<BillingState> {
  await requireAdmin(["owner"]);
  if (!isValidObjectId(paymentId)) return { message: "Unknown payment." };
  await connectDb();
  const removed = await Payment.findOneAndDelete({
    _id: paymentId,
    slug,
    source: "manual",
  }).lean();
  if (!removed) return { message: "This payment can't be removed." };
  if (removed.kind === "setup")
    await Client.updateOne(
      { slug },
      { $set: { "subscription.setupPaid": false } },
    );
  return done(slug, "Payment removed.");
}
