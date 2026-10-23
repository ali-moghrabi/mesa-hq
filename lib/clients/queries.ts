import "server-only";
import type { PipelineStage } from "mongoose";
import { connectDb } from "../db";
import { Client } from "../models/client";
import { FEATURES, YEARLY_MONTHS_PAID } from "./options";
import { overallState, toClientHealth } from "../health/state";
import type { ClientDetail } from "./detail";
import type { ClientFormValues } from "./schema";
import {
  todayIn,
  type ClientRow,
  type Facets,
  type ListFilters,
  type ListStats,
} from "./list";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function searchMatch(q: string): Record<string, unknown> {
  if (!q) return {};
  const words = q.split(/\s+/).filter(Boolean).slice(0, 5);
  return {
    $and: words.map((word) => {
      const re = new RegExp(escape(word), "i");
      const digits = word.replace(/\D/g, "");
      return {
        $or: [
          { name: re },
          { slug: re },
          { city: re },
          { "contact.name": re },
          { "contact.email": re },
          ...(digits.length >= 3
            ? [{ "contact.phone": new RegExp(digits.split("").join("\\D*")) }]
            : []),
          { "website.domain": re },
        ],
      };
    }),
  };
}

const SORT: Record<ListFilters["sort"], Record<string, 1 | -1>> = {
  recent: { createdAt: -1 },
  name: { name: 1 },
  billing: { "subscription.nextBillingDate": 1, name: 1 },
  price: { "subscription.monthlyPriceCents": -1, name: 1 },
};

type Lean = {
  _id: unknown;
  name: string;
  slug: string;
  city: string;
  country: string;
  contact: { name: string; email: string; phone: string; whatsapp?: string };
  subscription: {
    plan: ClientRow["plan"];
    cycle: ClientRow["cycle"];
    currency: string;
    monthlyPriceCents: number;
    status: ClientRow["status"];
    nextBillingDate?: string;
  };
  website?: { stage?: ClientRow["stage"]; domain?: string; apiUrl?: string };
  health?: unknown;
};

const NOT_DEMO = { isDemo: { $ne: true } };

const ROW_FIELDS = {
  name: 1,
  slug: 1,
  city: 1,
  country: 1,
  contact: 1,
  "subscription.plan": 1,
  "subscription.cycle": 1,
  "subscription.currency": 1,
  "subscription.monthlyPriceCents": 1,
  "subscription.status": 1,
  "subscription.nextBillingDate": 1,
  "website.stage": 1,
  "website.domain": 1,
  "website.apiUrl": 1,
  health: 1,
};

export async function listClients(filters: ListFilters): Promise<{
  rows: ClientRow[];
  facets: Facets;
  stats: ListStats;
  demo: ClientRow | null;
}> {
  await connectDb();
  const search = searchMatch(filters.q);
  const match: Record<string, unknown> = {
    ...NOT_DEMO,
    ...search,
    ...(filters.status && { "subscription.status": filters.status }),
    ...(filters.plan && { "subscription.plan": filters.plan }),
    ...(filters.stage && { "website.stage": filters.stage }),
    ...(filters.city && { city: new RegExp(`^${escape(filters.city)}$`, "i") }),
  };

  const facetMatch = (skip: "status" | "plan" | "stage") => ({
    ...NOT_DEMO,
    ...search,
    ...(skip !== "status" &&
      filters.status && { "subscription.status": filters.status }),
    ...(skip !== "plan" &&
      filters.plan && { "subscription.plan": filters.plan }),
    ...(skip !== "stage" &&
      filters.stage && { "website.stage": filters.stage }),
    ...(filters.city && { city: new RegExp(`^${escape(filters.city)}$`, "i") }),
  });
  const count = (
    skip: "status" | "plan" | "stage",
    field: string,
  ): PipelineStage[] => [
    { $match: facetMatch(skip) },
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
  ];

  const today = todayIn();
  const soon = todayIn(undefined, 7);

  const [docs, statusCounts, planCounts, stageCounts, statsAgg, demoDoc] =
    await Promise.all([
      Client.find(match, ROW_FIELDS)
        .sort(SORT[filters.sort])
        .limit(500)
        .lean<Lean[]>(),
      Client.aggregate<{ _id: string; n: number }>(
        count("status", "subscription.status"),
      ),
      Client.aggregate<{ _id: string; n: number }>(
        count("plan", "subscription.plan"),
      ),
      Client.aggregate<{ _id: string; n: number }>(
        count("stage", "website.stage"),
      ),
      Client.aggregate<{
        total: number;
        active: number;
        trial: number;
        dueSoon: number;
        overdue: number;
        mrr: { _id: string; cents: number }[];
      }>([
        { $match: NOT_DEMO },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  active: {
                    $sum: {
                      $cond: [
                        { $eq: ["$subscription.status", "active"] },
                        1,
                        0,
                      ],
                    },
                  },
                  trial: {
                    $sum: {
                      $cond: [{ $eq: ["$subscription.status", "trial"] }, 1, 0],
                    },
                  },
                  overdue: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            { $eq: ["$subscription.status", "active"] },
                            { $gt: ["$subscription.nextBillingDate", ""] },
                            { $lt: ["$subscription.nextBillingDate", today] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                  dueSoon: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            {
                              $in: [
                                "$subscription.status",
                                ["active", "trial"],
                              ],
                            },
                            { $gte: ["$subscription.nextBillingDate", today] },
                            { $lte: ["$subscription.nextBillingDate", soon] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
            ],
            mrr: [
              { $match: { "subscription.status": "active" } },
              {
                $group: {
                  _id: "$subscription.currency",
                  cents: {
                    $sum: {
                      $cond: [
                        { $eq: ["$subscription.cycle", "yearly"] },
                        {
                          $divide: [
                            {
                              $multiply: [
                                "$subscription.monthlyPriceCents",
                                YEARLY_MONTHS_PAID,
                              ],
                            },
                            12,
                          ],
                        },
                        "$subscription.monthlyPriceCents",
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
        {
          $project: {
            total: { $ifNull: [{ $first: "$totals.total" }, 0] },
            active: { $ifNull: [{ $first: "$totals.active" }, 0] },
            trial: { $ifNull: [{ $first: "$totals.trial" }, 0] },
            overdue: { $ifNull: [{ $first: "$totals.overdue" }, 0] },
            dueSoon: { $ifNull: [{ $first: "$totals.dueSoon" }, 0] },
            mrr: 1,
          },
        },
      ]),
      Client.findOne({ isDemo: true }, ROW_FIELDS).lean<Lean>(),
    ]);

  const toRow = (d: Lean, demo = false): ClientRow => ({
    id: String(d._id),
    name: d.name,
    slug: d.slug,
    city: d.city,
    country: d.country,
    contactName: d.contact?.name ?? "",
    email: d.contact?.email ?? "",
    phone: d.contact?.phone ?? "",
    whatsapp: d.contact?.whatsapp || d.contact?.phone || "",
    plan: d.subscription.plan,
    cycle: d.subscription.cycle,
    currency: d.subscription.currency,
    monthly: d.subscription.monthlyPriceCents / 100,
    status: d.subscription.status,
    stage: d.website?.stage ?? "onboarding",
    nextBillingDate: d.subscription.nextBillingDate ?? "",
    domain: d.website?.domain ?? "",
    // Live clients (and the demo, always) are checked: the others show no health dot
    health:
      demo || d.website?.stage === "live"
        ? overallState(
            toClientHealth(d.health),
            { website: !!d.website?.domain, api: !!d.website?.apiUrl },
            today,
          )
        : "off",
  });

  const tally = <K extends string>(rows: { _id: string; n: number }[]) =>
    Object.fromEntries(
      rows.filter((r) => r._id).map((r) => [r._id, r.n]),
    ) as Partial<Record<K, number>>;
  const s = statsAgg[0];

  return {
    rows: docs.map((d) => toRow(d)),
    demo: demoDoc ? toRow(demoDoc, true) : null,
    facets: {
      status: tally(statusCounts),
      plan: tally(planCounts),
      stage: tally(stageCounts),
    },
    stats: {
      total: s?.total ?? 0,
      active: s?.active ?? 0,
      trial: s?.trial ?? 0,
      dueSoon: s?.dueSoon ?? 0,
      overdue: s?.overdue ?? 0,
      mrr: (s?.mrr ?? [])
        .map((m) => ({ currency: m._id, amount: Math.round(m.cents) / 100 }))
        .sort((a, b) =>
          a.currency === "USD" ? -1 : b.currency === "USD" ? 1 : 0,
        ),
    },
  };
}

/** A stored client as read from Mongo. Every field may be missing on old documents. */
type StoredClient = {
  _id: unknown;
  name: string;
  slug: string;
  type?: string;
  city?: string;
  country?: string;
  address?: string;
  contact?: {
    name?: string;
    role?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
  };
  subscription?: {
    plan?: string;
    cycle?: string;
    currency?: string;
    monthlyPriceCents?: number;
    setupFeeCents?: number;
    founding?: boolean;
    setupPaid?: boolean;
    startDate?: string;
    billingDay?: number;
    status?: string;
    trialEndsAt?: string;
    paymentMethod?: string;
    nextBillingDate?: string;
  };
  website?: {
    stage?: string;
    domain?: string;
    launchDate?: string;
    features?: Record<string, boolean | undefined>;
    vercelProject?: string;
    renderService?: string;
    apiUrl?: string;
  };
  notes?: string;
  isDemo?: boolean;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

/** One client with every field filled in (empty strings and defaults for anything missing) */
export async function getClient(slug: string): Promise<ClientDetail | null> {
  await connectDb();
  const c = await Client.findOne({
    slug: slug.toLowerCase(),
  }).lean<StoredClient>();
  if (!c) return null;

  // Enum fields are plain strings here: the schema's enums keep them valid
  type D = ClientDetail;
  const contact = c.contact ?? {};
  const sub = c.subscription ?? {};
  const web = c.website ?? {};
  const features = web.features ?? {};

  return {
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    type: (c.type ?? "restaurant") as D["type"],
    city: c.city ?? "",
    country: c.country ?? "",
    address: c.address ?? "",
    contact: {
      name: contact.name ?? "",
      role: contact.role ?? "",
      phone: contact.phone ?? "",
      whatsapp: contact.whatsapp ?? "",
      email: contact.email ?? "",
    },
    plan: (sub.plan ?? "custom") as D["plan"],
    cycle: (sub.cycle ?? "monthly") as D["cycle"],
    currency: sub.currency ?? "USD",
    monthlyPrice: (sub.monthlyPriceCents ?? 0) / 100,
    setupFee: (sub.setupFeeCents ?? 0) / 100,
    founding: !!sub.founding,
    setupPaid: !!sub.setupPaid,
    startDate: sub.startDate ?? "",
    billingDay: sub.billingDay ?? 1,
    status: (sub.status ?? "active") as D["status"],
    trialEndsAt: sub.trialEndsAt ?? "",
    paymentMethod: (sub.paymentMethod ?? "cash") as D["paymentMethod"],
    nextBillingDate: sub.nextBillingDate ?? "",
    stage: (web.stage ?? "onboarding") as D["stage"],
    domain: web.domain ?? "",
    launchDate: web.launchDate ?? "",
    features: Object.fromEntries(
      FEATURES.map((f) => [f.id, !!features[f.id]]),
    ) as D["features"],
    vercelProject: web.vercelProject ?? "",
    renderService: web.renderService ?? "",
    apiUrl: web.apiUrl ?? "",
    notes: c.notes ?? "",
    isDemo: !!c.isDemo,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : "",
    updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : "",
    createdBy: c.createdBy ?? "",
  };
}

/** One client as the edit form's starting values (numbers as text, like the inputs hold them) */
export async function getClientForEdit(
  slug: string,
): Promise<{ name: string; slug: string; values: ClientFormValues } | null> {
  const c = await getClient(slug);
  if (!c) return null;
  return {
    name: c.name,
    slug: c.slug,
    values: {
      name: c.name,
      slug: c.slug,
      type: c.type,
      city: c.city,
      country: c.country,
      address: c.address,
      contactName: c.contact.name,
      contactRole: c.contact.role,
      phone: c.contact.phone,
      whatsapp: c.contact.whatsapp,
      email: c.contact.email,
      plan: c.plan,
      cycle: c.cycle,
      currency: c.currency as ClientFormValues["currency"],
      monthlyPrice: String(c.monthlyPrice),
      setupFee: String(c.setupFee),
      founding: c.founding,
      setupPaid: c.setupPaid,
      startDate: c.startDate,
      billingDay: String(c.billingDay),
      status: c.status,
      trialEndsAt: c.trialEndsAt,
      paymentMethod: c.paymentMethod,
      nextBillingDate: c.nextBillingDate,
      stage: c.stage,
      domain: c.domain,
      launchDate: c.launchDate,
      features: c.features,
      vercelProject: c.vercelProject,
      renderService: c.renderService,
      apiUrl: c.apiUrl,
      notes: c.notes,
      isDemo: c.isDemo,
    },
  };
}
