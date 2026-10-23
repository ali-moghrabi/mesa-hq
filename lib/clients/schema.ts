import { z } from "zod";
import {
  CURRENCIES,
  CYCLE_IDS,
  FEATURES,
  PAYMENT_METHOD_IDS,
  PLAN_IDS,
  RESTAURANT_TYPE_IDS,
  STAGE_IDS,
  STATUS_IDS,
  YEARLY_MONTHS_PAID,
} from "./options";

const RESERVED_SLUGS = ["create", "edit", "new"];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const date = (message: string) => z.string().regex(DATE, message);
const optionalDate = z.union([
  z.literal(""),
  z.string().regex(DATE, "Pick a date"),
]);
const phone = z
  .string()
  .trim()
  .max(30)
  .refine(
    (v) => v.replace(/\D/g, "").length >= 7,
    "Add a full phone number, with the country code",
  );
const money = (label: string) =>
  z
    .number({ message: `Enter the ${label}` })
    .finite()
    .min(0, `The ${label} can't be negative`)
    .max(100_000_000);

export const clientInputSchema = z
  .object({
    name: z.string().trim().min(2, "Add the restaurant's name").max(80),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, "At least 2 characters")
      .max(40, "40 characters at most")
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        "Lowercase letters, numbers and single dashes",
      )
      .refine((v) => !RESERVED_SLUGS.includes(v), "This id is reserved"),
    type: z.enum(RESTAURANT_TYPE_IDS),
    city: z.string().trim().min(2, "Add the city").max(60),
    country: z.string().trim().min(2, "Add the country").max(60),
    address: z.string().trim().max(160),

    contactName: z.string().trim().min(2, "Who do you deal with?").max(80),
    contactRole: z.string().trim().max(60),
    phone,
    whatsapp: z.union([z.literal(""), phone]),
    email: z.email("Add a valid email").trim().toLowerCase(),
    plan: z.enum(PLAN_IDS),
    cycle: z.enum(CYCLE_IDS),
    currency: z.enum(CURRENCIES),
    monthlyPrice: money("monthly price"),
    setupFee: money("setup fee"),
    founding: z.boolean(),
    setupPaid: z.boolean(),
    startDate: date("Pick the start date"),
    billingDay: z
      .number()
      .int()
      .min(1, "1 to 28")
      .max(28, "1 to 28 (so every month has it)"),
    status: z.enum(STATUS_IDS),
    trialEndsAt: optionalDate,
    paymentMethod: z.enum(PAYMENT_METHOD_IDS),
    nextBillingDate: optionalDate.optional(),

    stage: z.enum(STAGE_IDS),
    domain: z
      .string()
      .trim()
      .toLowerCase()
      .max(100)
      .refine(
        (v) => v === "" || /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v),
        "A bare domain, like place.com",
      ),
    launchDate: optionalDate,
    features: z.object(
      Object.fromEntries(FEATURES.map((f) => [f.id, z.boolean()])) as Record<
        (typeof FEATURES)[number]["id"],
        z.ZodBoolean
      >,
    ),
    vercelProject: z.string().trim().max(80),
    renderService: z.string().trim().max(80),
    apiUrl: z
      .string()
      .trim()
      .max(200)
      .refine(
        (v) =>
          v === "" || /^https?:\/\/[a-z0-9.-]+(:\d+)?(\/[^\s]*)?$/i.test(v),
        "A full address, like https://mesa-pizzanini-api.onrender.com",
      )
      .transform((v) => v.replace(/\/+$/, "").replace(/\/api(\/v\d+)?$/i, "")),

    notes: z.string().trim().max(2000),
    isDemo: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.status === "trial" && !v.trialEndsAt)
      ctx.addIssue({
        code: "custom",
        path: ["trialEndsAt"],
        message: "When does the trial end?",
      });
    if (v.trialEndsAt && v.trialEndsAt < v.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["trialEndsAt"],
        message: "After the start date",
      });
    if (v.status !== "trial" && v.plan !== "custom" && v.monthlyPrice === 0)
      ctx.addIssue({
        code: "custom",
        path: ["monthlyPrice"],
        message: "Enter the monthly price",
      });
  });

export type ClientInput = z.infer<typeof clientInputSchema>;

export type ClientFormValues = Omit<
  ClientInput,
  "monthlyPrice" | "setupFee" | "billingDay"
> & {
  monthlyPrice: string;
  setupFee: string;
  billingDay: string;
};

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    out[key] ??= issue.message;
  }
  return out;
}

export const billedAmount = (monthly: number, cycle: ClientInput["cycle"]) =>
  cycle === "yearly" ? monthly * YEARLY_MONTHS_PAID : monthly;

export const monthlyValue = (monthly: number, cycle: ClientInput["cycle"]) =>
  cycle === "yearly" ? (monthly * YEARLY_MONTHS_PAID) / 12 : monthly;

export function firstBillingDate(
  v: Pick<ClientInput, "startDate" | "status" | "trialEndsAt">,
): string {
  return v.status === "trial" && v.trialEndsAt ? v.trialEndsAt : v.startDate;
}

export function nextBillingAfter(
  fromDate: string,
  billingDay: number,
  cycle: ClientInput["cycle"],
): string {
  const [y, m, d] = fromDate.split("-").map(Number);
  const next =
    cycle === "yearly"
      ? new Date(Date.UTC(y + 1, m - 1, m === 2 && d === 29 ? 28 : d))
      : new Date(Date.UTC(y, m, billingDay));
  return next.toISOString().slice(0, 10);
}

export function nextBillingOnEdit(
  v: Pick<
    ClientInput,
    "startDate" | "status" | "trialEndsAt" | "nextBillingDate"
  >,
  today: string,
): string {
  if (v.status !== "active" && v.status !== "trial") return "";
  if (v.nextBillingDate) return v.nextBillingDate;
  const first = firstBillingDate(v);
  return first > today ? first : today;
}

export function effectiveBillingDay(
  v: Pick<ClientInput, "startDate" | "status" | "trialEndsAt" | "cycle">,
  billingDay: number,
): number {
  if (v.cycle !== "yearly") return billingDay;
  const day = Number(firstBillingDate(v).slice(8, 10));
  return Number.isFinite(day) && day > 0 ? Math.min(day, 28) : billingDay;
}
