import { Schema, type Model, type Types } from "mongoose";
import { CURRENCIES, type Currency } from "../clients/options";
import { defineSchema, registerModel } from "./register";

export const PAYMENT_SOURCES = ["stripe", "manual"] as const;
export const PAYMENT_KINDS = ["subscription", "setup", "other"] as const;
export const PAYMENT_STATUSES = ["paid", "refunded"] as const;

export interface PaymentDoc {
  _id: Types.ObjectId;
  client: Types.ObjectId;
  slug: string;
  clientName: string;
  source: (typeof PAYMENT_SOURCES)[number];
  kind: (typeof PAYMENT_KINDS)[number];
  status: (typeof PAYMENT_STATUSES)[number];
  amountCents: number;
  currency: Currency;
  paidAt: Date;
  periodStart: string;
  periodEnd: string;
  method: string;
  note: string;
  stripeInvoiceId?: string;
  invoiceNumber: string;
  invoiceUrl: string;
  receiptUrl: string;
  recordedBy: string;
  createdAt: Date;
}

const paymentSchema = defineSchema<PaymentDoc>(
  {
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    slug: { type: String, required: true },
    clientName: { type: String, default: "" },
    source: { type: String, enum: PAYMENT_SOURCES, required: true },
    kind: { type: String, enum: PAYMENT_KINDS, default: "subscription" },
    status: { type: String, enum: PAYMENT_STATUSES, default: "paid" },
    amountCents: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, required: true },
    paidAt: { type: Date, required: true },
    periodStart: { type: String, default: "" },
    periodEnd: { type: String, default: "" },
    method: { type: String, default: "", maxlength: 40 },
    note: { type: String, default: "", maxlength: 300 },
    stripeInvoiceId: { type: String, unique: true, sparse: true },
    invoiceNumber: { type: String, default: "" },
    invoiceUrl: { type: String, default: "" },
    receiptUrl: { type: String, default: "" },
    recordedBy: { type: String, default: "" },
  },
  { collection: "payments", timestamps: { createdAt: true, updatedAt: false } },
);
paymentSchema.index({ client: 1, paidAt: -1 });
paymentSchema.index({ paidAt: -1 });

export const Payment: Model<PaymentDoc> = registerModel(
  "Payment",
  paymentSchema,
);

export interface StripeEventDoc {
  _id: string;
  type: string;
  at: Date;
}

const stripeEventSchema = defineSchema<StripeEventDoc>(
  {
    _id: { type: String, required: true },
    type: { type: String, default: "" },
    at: { type: Date, default: () => new Date() },
  },
  { collection: "stripe_events", versionKey: false },
);
stripeEventSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

export const StripeEvent: Model<StripeEventDoc> = registerModel(
  "StripeEvent",
  stripeEventSchema,
);
