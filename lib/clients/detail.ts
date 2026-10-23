import {
  FEATURES,
  PAYMENT_METHODS,
  PLANS,
  RESTAURANT_TYPES,
  STAGES,
  STATUSES,
  YEARLY_MONTHS_PAID,
  type CycleId,
  type FeatureId,
  type PaymentMethodId,
  type PlanId,
  type RestaurantTypeId,
  type StageId,
  type StatusId,
} from "./options";

export type ClientDetail = {
  id: string;
  name: string;
  slug: string;
  type: RestaurantTypeId;
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
  plan: PlanId;
  cycle: CycleId;
  currency: string;
  monthlyPrice: number;
  setupFee: number;
  founding: boolean;
  setupPaid: boolean;
  startDate: string;
  billingDay: number;
  status: StatusId;
  trialEndsAt: string;
  paymentMethod: PaymentMethodId;
  nextBillingDate: string;
  stage: StageId;
  domain: string;
  launchDate: string;
  features: Record<FeatureId, boolean>;
  vercelProject: string;
  renderService: string;
  apiUrl: string;
  notes: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

const find = <T extends { id: string }>(list: readonly T[], id: string) =>
  list.find((x) => x.id === id);

export const planName = (id: string) => find(PLANS, id)?.name ?? id;
export const statusLabel = (id: string) => find(STATUSES, id)?.label ?? id;
export const stageLabel = (id: string) => find(STAGES, id)?.label ?? id;
export const methodLabel = (id: string) =>
  find(PAYMENT_METHODS, id)?.label ?? id;
export const typeLabel = (id: string) =>
  find(RESTAURANT_TYPES, id)?.label ?? id;
export const featureLabel = (id: string) => find(FEATURES, id)?.label ?? id;

export function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "LBP" ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export const billed = (c: Pick<ClientDetail, "monthlyPrice" | "cycle">) =>
  c.cycle === "yearly" ? c.monthlyPrice * YEARLY_MONTHS_PAID : c.monthlyPrice;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const utc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function longDate(iso: string) {
  if (!ISO_DATE.test(iso)) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(utc(iso));
}

export function daysBetween(from: string, to: string) {
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) return 0;
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

export function relativeDays(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

export function durationSince(start: string, today: string) {
  if (!ISO_DATE.test(start) || start > today) return "";
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let months = (ty - sy) * 12 + (tm - sm) - (td < sd ? 1 : 0);
  if (months < 1) {
    const days = daysBetween(start, today);
    return days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"}`;
  }
  const years = Math.floor(months / 12);
  months %= 12;
  const y = years ? `${years} year${years === 1 ? "" : "s"}` : "";
  const m = months ? `${months} month${months === 1 ? "" : "s"}` : "";
  return [y, m].filter(Boolean).join(" ");
}

export function dateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Beirut",
  }).format(d);
}

export function dayOf(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Beirut",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

export const phoneDigits = (phone: string) =>
  phone.replace(/\D/g, "").replace(/^00/, "");

export const whatsappUrl = (phone: string) => {
  const digits = phoneDigits(phone);
  return digits.length >= 7 ? `https://wa.me/${digits}` : null;
};

export const telUrl = (phone: string) => {
  const digits = phoneDigits(phone);
  if (digits.length < 7) return null;
  return `tel:${phone.trim().startsWith("+") || phone.trim().startsWith("00") ? "+" : ""}${digits}`;
};

export const siteUrl = (domain: string) =>
  domain ? `https://${domain}` : null;

export const mapsUrl = (
  c: Pick<ClientDetail, "address" | "city" | "country">,
) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [c.address, c.city, c.country].filter(Boolean).join(", "),
  )}`;
