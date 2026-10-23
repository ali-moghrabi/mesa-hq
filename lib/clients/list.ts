import {
  PLAN_IDS,
  STAGE_IDS,
  STATUS_IDS,
  type CycleId,
  type PlanId,
  type StageId,
  type StatusId,
} from "./options";
import type { OverallState } from "../health/state";

export const SORTS = [
  { id: "recent", label: "Newest first" },
  { id: "name", label: "Name A–Z" },
  { id: "billing", label: "Next payment" },
  { id: "price", label: "Highest price" },
] as const;
export type SortId = (typeof SORTS)[number]["id"];

export type ListFilters = {
  q: string;
  status?: StatusId;
  plan?: PlanId;
  stage?: StageId;
  city?: string;
  sort: SortId;
};

export const HQ_TIMEZONE = "Asia/Beirut";

const one = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;
const pick = <T extends string>(
  v: string | undefined,
  allowed: readonly T[],
) => (v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): ListFilters {
  return {
    q: (one(params.q) ?? "").trim().slice(0, 80),
    status: pick(one(params.status), STATUS_IDS),
    plan: pick(one(params.plan), PLAN_IDS),
    stage: pick(one(params.stage), STAGE_IDS),
    city: one(params.city)?.trim().slice(0, 60) || undefined,
    sort:
      pick(
        one(params.sort),
        SORTS.map((s) => s.id),
      ) ?? "recent",
  };
}

export function hrefWith(
  filters: ListFilters,
  change: Partial<Record<keyof ListFilters, string | undefined>>,
): string {
  const next: Record<string, string | undefined> = { ...filters, ...change };
  const params = new URLSearchParams();
  for (const key of ["q", "status", "plan", "stage", "city", "sort"] as const) {
    const value = next[key];
    if (value && !(key === "sort" && value === "recent"))
      params.set(key, value);
  }
  const query = params.toString();
  return query ? `/clients?${query}` : "/clients";
}

export type ClientRow = {
  id: string;
  name: string;
  slug: string;
  city: string;
  country: string;
  contactName: string;
  email: string;
  phone: string;
  whatsapp: string;
  plan: PlanId;
  cycle: CycleId;
  currency: string;
  monthly: number;
  status: StatusId;
  stage: StageId;
  nextBillingDate: string;
  domain: string;
  health: OverallState;
};

export type ListStats = {
  total: number;
  active: number;
  trial: number;
  mrr: { currency: string; amount: number }[];
  dueSoon: number;
  overdue: number;
};

export type Facets = {
  status: Partial<Record<StatusId, number>>;
  plan: Partial<Record<PlanId, number>>;
  stage: Partial<Record<StageId, number>>;
};

export function todayIn(timeZone = HQ_TIMEZONE, plusDays = 0): string {
  const d = new Date(Date.now() + plusDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
