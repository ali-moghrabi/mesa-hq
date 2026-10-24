import "server-only";
import { isValidObjectId, type Types } from "mongoose";
import { connectDb } from "../db";
import {
  OnboardingRequest,
  type OnboardingRequestDoc,
} from "../models/onboarding";
import {
  REQUEST_STATUS_IDS,
  type OnboardingAnswers,
  type OnboardingFile,
  type RequestStatus,
} from "./schema";

export type RequestRow = {
  id: string;
  ref: string;
  status: RequestStatus;
  source: "webhook" | "import";
  unread: boolean;
  submittedAt: string;
  name: string;
  type: OnboardingAnswers["restaurant"]["type"];
  cuisine: string[];
  city: string;
  country: string;
  person: string;
  email: string;
  phone: string;
  plan: OnboardingAnswers["extras"]["plan"];
  color: string;
  logo: string;
  services: {
    delivery: boolean;
    pickup: boolean;
    reservations: boolean;
    whatsapp: boolean;
  };
  fileCount: number;
  clientSlug: string;
};

export type RequestDetail = RequestRow & {
  answers: OnboardingAnswers;
  config: string;
  files: OnboardingFile[];
  notes: string;
  readAt: string;
  convertedAt: string;
  now: number;
};

type Stored = Omit<OnboardingRequestDoc, "config"> & { config?: string };

const iso = (d: Date | null | undefined) =>
  d ? new Date(d).toISOString() : "";

function toRow(r: Stored): RequestRow {
  const a = r.answers;
  const logo = r.files?.find(
    (f) => f.kind === "logo" && f.url?.startsWith("http"),
  );
  return {
    id: String(r._id),
    ref: r.ref,
    status: r.status,
    source: r.source,
    unread: !r.readAt,
    submittedAt: iso(r.submittedAt),
    name: a.restaurant.name,
    type: a.restaurant.type,
    cuisine: a.restaurant.cuisine ?? [],
    city: a.contact.city,
    country: a.contact.country,
    person: a.person.name,
    email: a.contact.email,
    phone: a.person.phone,
    plan: a.extras.plan,
    color: a.brand.primaryColor,
    logo: logo?.url ?? "",
    services: {
      delivery: a.services.delivery,
      pickup: a.services.pickup,
      reservations: a.services.reservations,
      whatsapp: a.services.whatsappOrdering,
    },
    fileCount: r.files?.length ?? 0,
    clientSlug: r.clientSlug ?? "",
  };
}

export type RequestFilter = RequestStatus | "open" | "all";

export const REQUEST_FILTERS: { id: RequestFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "new", label: "New" },
  { id: "reviewing", label: "Reviewing" },
  { id: "converted", label: "Converted" },
  { id: "declined", label: "Declined" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

export function parseRequestFilter(value: unknown): RequestFilter {
  return REQUEST_FILTERS.some((f) => f.id === value)
    ? (value as RequestFilter)
    : "open";
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function listRequests(filter: RequestFilter, q: string) {
  await connectDb();
  const words = q.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  const search: Record<string, unknown> = words.length
    ? {
        $and: words.map((w) => {
          const re = new RegExp(escape(w), "i");
          return {
            $or: [
              { "answers.restaurant.name": re },
              { "answers.restaurant.cuisine": re },
              { "answers.contact.city": re },
              { "answers.contact.email": re },
              { "answers.person.name": re },
              { ref: re },
            ],
          };
        }),
      }
    : {};
  const byStatus: Record<string, unknown> =
    filter === "all"
      ? {}
      : filter === "open"
        ? { status: { $in: ["new", "reviewing"] } }
        : { status: filter };

  const [docs, counts] = await Promise.all([
    OnboardingRequest.find({ ...search, ...byStatus }, { config: 0 })
      .sort({ submittedAt: -1 })
      .limit(300)
      .lean<Stored[]>(),
    OnboardingRequest.aggregate<{ _id: RequestStatus; n: number }>([
      { $match: search },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
  ]);

  const byId = Object.fromEntries(counts.map((c) => [c._id, c.n])) as Partial<
    Record<RequestStatus, number>
  >;
  const tally: Record<RequestFilter, number> = {
    open: (byId.new ?? 0) + (byId.reviewing ?? 0),
    all: counts.reduce((sum, c) => sum + c.n, 0),
    ...(Object.fromEntries(
      REQUEST_STATUS_IDS.map((s) => [s, byId[s] ?? 0]),
    ) as Record<RequestStatus, number>),
  };

  return { rows: docs.map(toRow), counts: tally, now: Date.now() };
}

export async function getRequest(id: string): Promise<RequestDetail | null> {
  if (!isValidObjectId(id)) return null;
  await connectDb();
  const r = await OnboardingRequest.findById(id).lean<Stored>();
  if (!r) return null;
  if (!r.readAt) {
    r.readAt = new Date();
    await OnboardingRequest.updateOne(
      { _id: r._id, readAt: null },
      { $set: { readAt: r.readAt } },
    );
  }
  return {
    ...toRow(r),
    unread: false,
    answers: r.answers,
    config: r.config ?? "{}",
    files: r.files ?? [],
    notes: r.notes ?? "",
    readAt: iso(r.readAt),
    convertedAt: iso(r.convertedAt),
    now: Date.now(),
  };
}

export async function getRequestForConvert(id: string) {
  if (!isValidObjectId(id)) return null;
  await connectDb();
  return OnboardingRequest.findById(id, {
    ref: 1,
    answers: 1,
    clientSlug: 1,
  }).lean<{
    _id: Types.ObjectId;
    ref: string;
    answers: OnboardingAnswers;
    clientSlug: string;
  }>();
}

export async function countUnread(): Promise<number> {
  await connectDb();
  return OnboardingRequest.countDocuments({ readAt: null, status: "new" });
}
