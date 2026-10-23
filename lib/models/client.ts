import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "./register";
import {
  CURRENCIES,
  CYCLE_IDS,
  FEATURES,
  PAYMENT_METHOD_IDS,
  PLAN_IDS,
  RESTAURANT_TYPE_IDS,
  STAGE_IDS,
  STATUS_IDS,
} from "../clients/options";

const targetHealthSchema = new Schema(
  {
    ok: { type: Boolean, default: null },
    status: { type: Number, default: 0 },
    ms: { type: Number, default: 0 },
    error: { type: String, default: "" },
    failures: { type: Number, default: 0 },
    down: { type: Boolean, default: false },
    since: { type: Date, default: null },
    checkedAt: { type: Date, default: null },
  },
  { _id: false },
);

const healthSchema = new Schema(
  {
    website: { type: targetHealthSchema, default: () => ({}) },
    api: { type: targetHealthSchema, default: () => ({}) },
    sslExpiresAt: { type: String, default: "" },
    sslError: { type: String, default: "" },
    domainExpiresAt: { type: String, default: "" },
    expiryCheckedAt: { type: Date, default: null },
    sslWarnedFor: { type: String, default: "" },
    domainWarnedFor: { type: String, default: "" },
    checkedAt: { type: Date, default: null },
  },
  { _id: false },
);

const clientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    type: { type: String, enum: RESTAURANT_TYPE_IDS, default: "restaurant" },
    isDemo: { type: Boolean, default: false, index: true },
    city: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },

    contact: {
      name: { type: String, required: true, trim: true },
      role: { type: String, default: "", trim: true },
      phone: { type: String, required: true, trim: true },
      whatsapp: { type: String, default: "", trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
    },

    subscription: {
      plan: { type: String, enum: PLAN_IDS, required: true },
      cycle: { type: String, enum: CYCLE_IDS, default: "monthly" },
      currency: { type: String, enum: CURRENCIES, default: "USD" },
      monthlyPriceCents: { type: Number, required: true, min: 0 },
      setupFeeCents: { type: Number, default: 0, min: 0 },
      founding: { type: Boolean, default: false },
      setupPaid: { type: Boolean, default: false },
      startDate: { type: String, required: true },
      billingDay: { type: Number, required: true, min: 1, max: 28 },
      status: {
        type: String,
        enum: STATUS_IDS,
        default: "active",
        index: true,
      },
      trialEndsAt: { type: String, default: "" },
      paymentMethod: {
        type: String,
        enum: PAYMENT_METHOD_IDS,
        default: "cash",
      },
      nextBillingDate: { type: String, default: "", index: true },
    },

    website: {
      stage: { type: String, enum: STAGE_IDS, default: "onboarding" },
      domain: { type: String, default: "", lowercase: true, trim: true },
      launchDate: { type: String, default: "" },
      features: Object.fromEntries(
        FEATURES.map((f) => [f.id, { type: Boolean, default: false }]),
      ),
      vercelProject: { type: String, default: "", trim: true },
      renderService: { type: String, default: "", trim: true },
      apiUrl: { type: String, default: "", trim: true },
    },

    health: { type: healthSchema, default: () => ({}) },

    notes: { type: String, default: "" },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "clients" },
);

export type ClientDoc = InferSchemaType<typeof clientSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Client: Model<ClientDoc> = registerModel<ClientDoc>(
  "Client",
  clientSchema,
);
