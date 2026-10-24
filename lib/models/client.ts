import type { Model, Types } from "mongoose";
import { defineSchema, registerModel } from "./register";
import {
  CURRENCIES,
  CYCLE_IDS,
  FEATURES,
  PAYMENT_METHOD_IDS,
  PLAN_IDS,
  RESTAURANT_TYPE_IDS,
  STAGE_IDS,
  STATUS_IDS,
  type Currency,
  type CycleId,
  type FeatureId,
  type PaymentMethodId,
  type PlanId,
  type RestaurantTypeId,
  type StageId,
  type StatusId,
} from "../clients/options";

export interface TargetHealthDoc {
  ok: boolean | null;
  status: number;
  ms: number;
  error: string;
  failures: number;
  down: boolean;
  since: Date | null;
  checkedAt: Date | null;
}

export interface ClientHealthDoc {
  website: TargetHealthDoc;
  api: TargetHealthDoc;
  sslExpiresAt: string;
  sslError: string;
  domainExpiresAt: string;
  expiryCheckedAt: Date | null;
  sslWarnedFor: string;
  domainWarnedFor: string;
  checkedAt: Date | null;
}

export interface ClientDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  type: RestaurantTypeId;
  isDemo: boolean;
  city: string;
  country: string;
  address: string;
  contact: {
    name: string;
    role: string;
    phone: string;
    whatsapp: string;
    email: string;
  };
  subscription: {
    plan: PlanId;
    cycle: CycleId;
    currency: Currency;
    monthlyPriceCents: number;
    setupFeeCents: number;
    founding: boolean;
    setupPaid: boolean;
    startDate: string;
    billingDay: number;
    status: StatusId;
    trialEndsAt: string;
    paymentMethod: PaymentMethodId;
    nextBillingDate: string;
  };
  website: {
    stage: StageId;
    domain: string;
    launchDate: string;
    features: Record<FeatureId, boolean>;
    vercelProject: string;
    renderService: string;
    apiUrl: string;
  };
  health: ClientHealthDoc;
  notes: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const targetHealthSchema = defineSchema<TargetHealthDoc>(
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

const healthSchema = defineSchema<ClientHealthDoc>(
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

const clientSchema = defineSchema<ClientDoc>(
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

export const Client: Model<ClientDoc> = registerModel("Client", clientSchema);
