export const PLANS = [
  {
    id: "essential",
    name: "Essential",
    setup: 400,
    monthly: 30,
    blurb: "Menu, gallery, reservations, hours",
  },
  {
    id: "pro",
    name: "Pro",
    setup: 800,
    monthly: 60,
    blurb: "+ online ordering, payments, promotions",
    recommended: true,
  },
  {
    id: "signature",
    name: "Signature",
    setup: 1800,
    monthly: 120,
    blurb: "+ full content entry, same-day changes",
  },
  {
    id: "custom",
    name: "Custom",
    setup: 0,
    monthly: 0,
    blurb: "Your own price and scope",
  },
] as const;
export type PlanId = (typeof PLANS)[number]["id"];
export const PLAN_IDS = PLANS.map((p) => p.id) as [PlanId, ...PlanId[]];

export const YEARLY_MONTHS_PAID = 10;
export const FOUNDING_DISCOUNT = 0.4;

export const CYCLES = [
  {
    id: "monthly",
    label: "Monthly",
    months: 1,
    paidMonths: 1,
    short: "mo",
    every: "month",
    interval: "month",
    intervalCount: 1,
  },
  {
    id: "quarterly",
    label: "3 months",
    months: 3,
    paidMonths: 3,
    short: "3 mo",
    every: "3 months",
    interval: "month",
    intervalCount: 3,
  },
  {
    id: "semiannual",
    label: "6 months",
    months: 6,
    paidMonths: 6,
    short: "6 mo",
    every: "6 months",
    interval: "month",
    intervalCount: 6,
  },
  {
    id: "yearly",
    label: "Yearly",
    months: 12,
    paidMonths: YEARLY_MONTHS_PAID,
    short: "yr",
    every: "year",
    interval: "year",
    intervalCount: 1,
  },
] as const;
export type CycleId = (typeof CYCLES)[number]["id"];
export type Cycle = (typeof CYCLES)[number];

export const cycleOf = (id: string): Cycle =>
  CYCLES.find((c) => c.id === id) ?? CYCLES[0];

export const CURRENCIES = ["USD", "LBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const STATUSES = [
  { id: "trial", label: "Trial", hint: "Free until the trial ends" },
  { id: "active", label: "Active", hint: "Billed every cycle" },
  {
    id: "past_due",
    label: "Payment failed",
    hint: "The last charge failed; Stripe retries it",
  },
  { id: "paused", label: "Paused", hint: "Not billed for now" },
  { id: "cancelled", label: "Cancelled", hint: "No longer a client" },
] as const;
export type StatusId = (typeof STATUSES)[number]["id"];

export const BILLED_STATUSES: readonly StatusId[] = [
  "active",
  "trial",
  "past_due",
];

export const BILLING_MODES = [
  { id: "manual", label: "Manual" },
  { id: "stripe", label: "Automatic (Stripe)" },
] as const;
export type BillingModeId = (typeof BILLING_MODES)[number]["id"];

export const STAGES = [
  { id: "onboarding", label: "Onboarding" },
  { id: "building", label: "Building" },
  { id: "preview", label: "In review" },
  { id: "live", label: "Live" },
] as const;
export type StageId = (typeof STAGES)[number]["id"];

export const PAYMENT_METHODS = [
  { id: "cash", label: "Cash" },
  { id: "whish", label: "Whish" },
  { id: "omt", label: "OMT" },
  { id: "bank", label: "Bank transfer" },
  { id: "card", label: "Card" },
] as const;
export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

export const RESTAURANT_TYPES = [
  { id: "restaurant", label: "Restaurant" },
  { id: "cafe", label: "Café" },
  { id: "bar", label: "Bar" },
  { id: "bakery", label: "Bakery" },
  { id: "fast-food", label: "Fast food" },
  { id: "other", label: "Other" },
] as const;
export type RestaurantTypeId = (typeof RESTAURANT_TYPES)[number]["id"];

export const FEATURES = [
  { id: "onlineOrdering", label: "Online ordering" },
  { id: "reservations", label: "Reservations" },
  { id: "whatsappOrdering", label: "WhatsApp ordering" },
  { id: "cardPayments", label: "Card payments" },
  { id: "qrMenus", label: "QR table menus" },
  { id: "newsletter", label: "Newsletter" },
] as const;
export type FeatureId = (typeof FEATURES)[number]["id"];

const ids = <T extends readonly { id: string }[]>(list: T) =>
  list.map((x) => x.id) as [T[number]["id"], ...T[number]["id"][]];
export const STATUS_IDS = ids(STATUSES);
export const STAGE_IDS = ids(STAGES);
export const PAYMENT_METHOD_IDS = ids(PAYMENT_METHODS);
export const RESTAURANT_TYPE_IDS = ids(RESTAURANT_TYPES);
export const CYCLE_IDS = ids(CYCLES);
export const BILLING_MODE_IDS = ids(BILLING_MODES);
