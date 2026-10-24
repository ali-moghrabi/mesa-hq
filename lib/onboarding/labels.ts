import { PLANS, type FeatureId, type PlanId } from "../clients/options";
import type { ClientFormValues } from "../clients/schema";
import type { Day, OnboardingAnswers, RequestStatus } from "./schema";

export const RESTAURANT_TYPE: Record<
  OnboardingAnswers["restaurant"]["type"],
  { label: string; id: ClientFormValues["type"] }
> = {
  Restaurant: { label: "Restaurant", id: "restaurant" },
  Cafe: { label: "Café", id: "cafe" },
  Bar: { label: "Bar", id: "bar" },
  Bakery: { label: "Bakery", id: "bakery" },
  FastFood: { label: "Fast food", id: "fast-food" },
  Other: { label: "Other", id: "other" },
};

export const PLAN_WANTED: Record<OnboardingAnswers["extras"]["plan"], string> =
  {
    essential: "Essential",
    pro: "Pro",
    signature: "Signature",
    unsure: "Not sure yet",
  };

export const PAYMENT_LABEL: Record<
  OnboardingAnswers["services"]["payments"][number],
  string
> = { cash: "Cash", card: "Card", whish: "Whish" };

export const DAY_LABEL: Record<Day, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const STATUS_TONE: Record<RequestStatus, { dot: string; pill: string }> =
  {
    new: {
      dot: "bg-primary",
      pill: "border-primary/30 bg-primary/12 text-primary",
    },
    reviewing: {
      dot: "bg-accent",
      pill: "border-accent/25 bg-accent/10 text-accent",
    },
    converted: {
      dot: "bg-success",
      pill: "border-success/25 bg-success/10 text-success",
    },
    declined: {
      dot: "bg-destructive",
      pill: "border-destructive/25 bg-destructive/10 text-destructive",
    },
    archived: {
      dot: "bg-muted-foreground",
      pill: "border-border-strong bg-muted text-muted-foreground",
    },
  };

export const addressOf = (c: OnboardingAnswers["contact"]) =>
  [c.street, c.area].filter(Boolean).join(", ");

export function featuresFrom(a: OnboardingAnswers): Record<FeatureId, boolean> {
  return {
    onlineOrdering: a.services.delivery || a.services.pickup,
    reservations: a.services.reservations,
    whatsappOrdering: a.services.whatsappOrdering,
    cardPayments: a.services.payments.includes("card"),
    qrMenus: false,
    newsletter: false,
  };
}

const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");

function bareDomain(value: string) {
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
  return /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : "";
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function clientPrefill(
  a: OnboardingAnswers,
  ref: string,
): ClientFormValues {
  const plan: PlanId = a.extras.plan === "unsure" ? "pro" : a.extras.plan;
  const prices = PLANS.find((p) => p.id === plan)!;
  const start = today();
  return {
    name: a.restaurant.name,
    slug: slugify(a.restaurant.name),
    type: RESTAURANT_TYPE[a.restaurant.type].id,
    city: a.contact.city,
    country: a.contact.country,
    address: addressOf(a.contact),
    isDemo: false,
    contactName: a.person.name,
    contactRole: a.person.role,
    phone: a.person.phone,
    whatsapp: "",
    email: a.contact.email,
    plan,
    cycle: "monthly",
    currency: a.services.currency === "LBP" ? "LBP" : "USD",
    monthlyPrice: String(prices.monthly),
    setupFee: String(prices.setup),
    founding: false,
    setupPaid: false,
    startDate: start,
    billingDay: String(Math.min(Number(start.slice(8, 10)), 28)),
    status: "active",
    trialEndsAt: "",
    paymentMethod: a.services.payments.includes("whish") ? "whish" : "cash",
    stage: "onboarding",
    domain: bareDomain(a.extras.domain),
    launchDate: "",
    apiUrl: "",
    features: featuresFrom(a),
    vercelProject: "",
    renderService: "",
    notes: [
      `From the onboarding form (${ref}).`,
      a.extras.plan === "unsure" ? "They weren't sure about the plan." : "",
      a.extras.notes ? `Their notes: ${a.extras.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 2000),
  };
}
