import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.stripe.com/v1";
export const STRIPE_VERSION = "2025-03-31.basil";

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;
export const stripeTestMode = () =>
  (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");

type Params = Record<string, unknown>;

function encode(params: Params, prefix = "", out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (value === null) out.append(name, "");
    else if (Array.isArray(value))
      value.forEach((item, i) =>
        typeof item === "object" && item !== null
          ? encode(item as Params, `${name}[${i}]`, out)
          : out.append(`${name}[${i}]`, String(item)),
      );
    else if (typeof value === "object") encode(value as Params, name, out);
    else out.append(name, String(value));
  }
  return out;
}

export async function stripe<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Params = {},
  options: { idempotencyKey?: string } = {},
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key)
    throw new StripeError(
      "Stripe isn't set up yet: add STRIPE_SECRET_KEY to HQ's environment.",
      0,
    );
  const body = encode(params);
  const url =
    method === "GET" && body.size ? `${API}${path}?${body}` : `${API}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${key}`,
      "stripe-version": STRIPE_VERSION,
      ...(method !== "GET" && {
        "content-type": "application/x-www-form-urlencoded",
      }),
      ...(options.idempotencyKey && {
        "idempotency-key": options.idempotencyKey,
      }),
    },
    body: method === "GET" ? undefined : body,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; code?: string };
  };
  if (!response.ok)
    throw new StripeError(
      data.error?.message ?? `Stripe answered HTTP ${response.status}`,
      response.status,
      data.error?.code,
    );
  return data as T;
}

export function verifyWebhook(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const timestamp = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest();
  return signatures.some((sig) => {
    const given = Buffer.from(sig ?? "", "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export type StripeCard = {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
};

export type StripePaymentMethod = { id: string; card?: StripeCard };

export type StripeSubscription = {
  id: string;
  customer: string;
  status:
    | "trialing"
    | "active"
    | "past_due"
    | "unpaid"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "paused";
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  current_period_end?: number;
  trial_end: number | null;
  pause_collection: { behavior: string; resumes_at: number | null } | null;
  default_payment_method: string | StripePaymentMethod | null;
  metadata: Record<string, string>;
  items: {
    data: {
      id: string;
      current_period_end?: number;
      current_period_start?: number;
      price: {
        id: string;
        unit_amount: number | null;
        currency: string;
        recurring: { interval: string; interval_count: number } | null;
      };
    }[];
  };
};

export type StripeInvoice = {
  id: string;
  number: string | null;
  customer: string;
  status: string;
  amount_paid: number;
  amount_due: number;
  currency: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  attempt_count: number;
  next_payment_attempt: number | null;
  billing_reason: string | null;
  status_transitions?: { paid_at: number | null };
  period_start: number;
  period_end: number;
  lines?: { data: { period?: { start: number; end: number } }[] };
  subscription?: string | null;
  parent?: { subscription_details?: { subscription?: string } | null } | null;
  last_finalization_error?: { message?: string } | null;
};

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  expires_at: number;
  mode: string;
  customer: string | null;
  subscription: string | null;
  setup_intent?: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string>;
};

export const subscriptionOfInvoice = (invoice: StripeInvoice) =>
  invoice.parent?.subscription_details?.subscription ??
  invoice.subscription ??
  null;

export const periodEnd = (sub: StripeSubscription) =>
  sub.items.data[0]?.current_period_end ?? sub.current_period_end ?? null;
