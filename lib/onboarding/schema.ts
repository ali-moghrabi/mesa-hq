import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).optional().default("");
const url = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === "" || /^https?:\/\/\S+$/i.test(v),
    "Use a full link starting with https://",
  )
  .optional()
  .default("");
const money = z.number().min(0).max(100_000).optional();
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30");

export const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type Day = (typeof DAYS)[number];

const day = z.object({
  closed: z.boolean(),
  shifts: z.array(z.object({ open: time, close: time })).max(2),
});

export const onboardingAnswersSchema = z.object({
  restaurant: z.object({
    name: text(80).min(2),
    type: z.enum(["Restaurant", "Cafe", "Bar", "Bakery", "FastFood", "Other"]),
    cuisine: z.array(text(40)).min(1).max(6),
    priceRange: z.enum(["$", "$$", "$$$", "$$$$"]),
    description: text(600),
    tagline: optionalText(120),
    since: optionalText(10),
  }),
  contact: z.object({
    mapsLink: url,
    location: optionalText(120),
    street: optionalText(160),
    area: optionalText(80),
    city: text(80).min(2),
    country: text(80).min(2),
    phone: text(30).min(6),
    whatsapp: optionalText(30),
    email: z.string().trim().email().max(200),
    instagram: url,
    facebook: url,
    tiktok: url,
    legalName: optionalText(120),
  }),
  brand: z.object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    mode: z.enum(["light", "dark"]),
  }),
  hours: z.object(
    Object.fromEntries(DAYS.map((d) => [d, day])) as Record<Day, typeof day>,
  ),
  services: z.object({
    reservations: z.boolean(),
    maxPartySize: z.number().int().min(1).max(100).optional(),
    delivery: z.boolean(),
    deliveryFee: money,
    deliveryMinimum: money,
    deliveryFreeOver: money,
    deliveryAreas: optionalText(600),
    pickup: z.boolean(),
    whatsappOrdering: z.boolean(),
    payments: z.array(z.enum(["cash", "card", "whish"])).max(3),
    currency: z.enum(["USD", "LBP", "EUR", "AED", "SAR"]),
  }),
  extras: z.object({
    menuLink: url,
    domain: optionalText(120),
    plan: z.enum(["essential", "pro", "signature", "unsure"]),
    notes: optionalText(2000),
  }),
  person: z.object({
    name: text(80).min(2),
    role: optionalText(60),
    phone: text(30).min(6),
  }),
});

export type OnboardingAnswers = z.infer<typeof onboardingAnswersSchema>;

export const onboardingFileSchema = z.object({
  kind: z.enum(["logo", "photo", "menu"]),
  name: z.string().max(200),
  url: z.string().max(1000).optional(),
  bytes: z.number().int().min(0).max(100_000_000),
});
export type OnboardingFile = z.infer<typeof onboardingFileSchema>;

export const onboardingPayloadSchema = z.object({
  id: z.string().trim().min(3).max(120),
  submittedAt: z.string().datetime().optional(),
  answers: onboardingAnswersSchema,
  config: z.string().max(400_000).default("{}"),
  files: z.array(onboardingFileSchema).max(30).default([]),
});
export type OnboardingPayload = z.infer<typeof onboardingPayloadSchema>;

export const REQUEST_STATUSES = [
  { id: "new", label: "New" },
  { id: "reviewing", label: "Reviewing" },
  { id: "converted", label: "Converted" },
  { id: "declined", label: "Declined" },
  { id: "archived", label: "Archived" },
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number]["id"];
export const REQUEST_STATUS_IDS = REQUEST_STATUSES.map((s) => s.id) as [
  RequestStatus,
  ...RequestStatus[],
];
