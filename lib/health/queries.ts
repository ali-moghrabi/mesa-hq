import "server-only";
import type { Types } from "mongoose";
import { connectDb } from "../db";
import { Client } from "../models/client";
import {
  HEALTH_TARGETS,
  HealthCheck,
  Incident,
  type HealthTarget,
} from "../models/health";
import { channelsConfigured, type Channel } from "./notify";
import { toClientHealth, type ClientHealth } from "./state";

const DAY = 86_400_000;
const SLOTS = 48;
const SLOT_MS = DAY / SLOTS;

export type Slot = "ok" | "slow" | "fail" | "none";
export type Uptime = {
  d1: number | null;
  d7: number | null;
  d30: number | null;
  avgMs: number | null;
};
export type IncidentRow = {
  id: string;
  target: HealthTarget;
  cause: string;
  startedAt: string;
  resolvedAt: string;
};

export type HealthDetail = {
  health: ClientHealth;
  monitored: Record<HealthTarget, boolean>;
  uptime: Record<HealthTarget, Uptime>;
  bars: Record<HealthTarget, Slot[]>;
  incidents: IncidentRow[];
  now: number;
};

const pct = (ok: number, total: number) =>
  total ? Math.round((ok / total) * 1000) / 10 : null;

async function uptimeFor(
  match: Record<string, unknown>,
  now: number,
): Promise<{ client: string; target: HealthTarget; uptime: Uptime }[]> {
  const since = (days: number) => new Date(now - days * DAY);
  const rows = await HealthCheck.aggregate<{
    _id: { client: Types.ObjectId; target: HealthTarget };
    total30: number;
    ok30: number;
    total7: number;
    ok7: number;
    total1: number;
    ok1: number;
    msSum: number;
    msCount: number;
  }>([
    { $match: { ...match, at: { $gte: since(30) } } },
    {
      $group: {
        _id: { client: "$client", target: "$target" },
        total30: { $sum: 1 },
        ok30: { $sum: { $cond: ["$ok", 1, 0] } },
        total7: { $sum: { $cond: [{ $gte: ["$at", since(7)] }, 1, 0] } },
        ok7: {
          $sum: {
            $cond: [{ $and: ["$ok", { $gte: ["$at", since(7)] }] }, 1, 0],
          },
        },
        total1: { $sum: { $cond: [{ $gte: ["$at", since(1)] }, 1, 0] } },
        ok1: {
          $sum: {
            $cond: [{ $and: ["$ok", { $gte: ["$at", since(1)] }] }, 1, 0],
          },
        },
        msSum: {
          $sum: {
            $cond: [{ $and: ["$ok", { $gte: ["$at", since(1)] }] }, "$ms", 0],
          },
        },
        msCount: {
          $sum: {
            $cond: [{ $and: ["$ok", { $gte: ["$at", since(1)] }] }, 1, 0],
          },
        },
      },
    },
  ]);
  return rows.map((r) => ({
    client: String(r._id.client),
    target: r._id.target,
    uptime: {
      d1: pct(r.ok1, r.total1),
      d7: pct(r.ok7, r.total7),
      d30: pct(r.ok30, r.total30),
      avgMs: r.msCount ? Math.round(r.msSum / r.msCount) : null,
    },
  }));
}

const emptyUptime = (): Uptime => ({
  d1: null,
  d7: null,
  d30: null,
  avgMs: null,
});

/** Everything the Health card on a client's page shows */
export async function getClientHealth(
  clientId: string,
  slowMs: number,
): Promise<HealthDetail | null> {
  await connectDb();
  const c = await Client.findById(clientId, { health: 1, website: 1 }).lean<{
    _id: Types.ObjectId;
    health?: unknown;
    website?: { domain?: string; apiUrl?: string };
  }>();
  if (!c) return null;

  const now = Date.now();
  const [uptimes, recent, incidents] = await Promise.all([
    uptimeFor({ client: c._id }, now),
    HealthCheck.find(
      { client: c._id, at: { $gte: new Date(now - DAY) } },
      { target: 1, ok: 1, ms: 1, at: 1, _id: 0 },
    ).lean<{ target: HealthTarget; ok: boolean; ms: number; at: Date }[]>(),
    Incident.find({ client: c._id }).sort({ startedAt: -1 }).limit(8).lean(),
  ]);

  const uptime = { website: emptyUptime(), api: emptyUptime() };
  for (const u of uptimes) uptime[u.target] = u.uptime;

  // The worst result in each 30-minute slot wins
  const rank: Record<Slot, number> = { none: 0, ok: 1, slow: 2, fail: 3 };
  const bars = Object.fromEntries(
    HEALTH_TARGETS.map((t) => [t, Array<Slot>(SLOTS).fill("none")]),
  ) as Record<HealthTarget, Slot[]>;
  const start = now - DAY;
  for (const check of recent) {
    const i = Math.min(
      SLOTS - 1,
      Math.floor((new Date(check.at).getTime() - start) / SLOT_MS),
    );
    if (i < 0) continue;
    const value: Slot = !check.ok ? "fail" : check.ms > slowMs ? "slow" : "ok";
    if (rank[value] > rank[bars[check.target][i]])
      bars[check.target][i] = value;
  }

  return {
    now,
    health: toClientHealth(c.health),
    monitored: { website: !!c.website?.domain, api: !!c.website?.apiUrl },
    uptime,
    bars,
    incidents: incidents.map((i) => ({
      id: String(i._id),
      target: i.target as HealthTarget,
      cause: i.cause ?? "",
      startedAt: new Date(i.startedAt).toISOString(),
      resolvedAt: i.resolvedAt ? new Date(i.resolvedAt).toISOString() : "",
    })),
  };
}

export type HealthRow = {
  slug: string;
  name: string;
  stage: string;
  domain: string;
  apiUrl: string;
  health: ClientHealth;
  uptime7: Record<HealthTarget, number | null>;
  openIncidents: number;
};

export type HealthOverview = {
  rows: HealthRow[];
  /** The MESA Demo, pinned above everything (not counted in the numbers) */
  demo: HealthRow | null;
  /** Live clients missing a domain or an API address: they can't be (fully) checked */
  incomplete: { slug: string; name: string; missing: string[] }[];
  incidents: (IncidentRow & { slug: string; name: string })[];
  channels: Record<Channel, boolean>;
  /** "on": deployed on Vercel with CRON_SECRET; "local": run by `npm run health -- --watch` */
  schedule: "on" | "missing-secret" | "local";
  /** When this was read (ms) */
  now: number;
};

/** The Health page: every monitored client, the latest incidents, and how alerts are set up */
export async function getHealthOverview(): Promise<HealthOverview> {
  await connectDb();
  const clients = await Client.find(
    {
      $or: [
        { "website.stage": "live" },
        { "health.checkedAt": { $ne: null } },
        { isDemo: true },
      ],
    },
    { name: 1, slug: 1, isDemo: 1, website: 1, health: 1 },
  )
    .sort({ name: 1 })
    .lean<
      {
        _id: Types.ObjectId;
        name: string;
        slug: string;
        isDemo?: boolean;
        website?: { stage?: string; domain?: string; apiUrl?: string };
        health?: unknown;
      }[]
    >();

  const now = Date.now();
  const ids = clients.map((c) => c._id);
  const [uptimes, open, latest] = await Promise.all([
    uptimeFor({ client: { $in: ids } }, now),
    Incident.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { client: { $in: ids }, resolvedAt: null } },
      { $group: { _id: "$client", n: { $sum: 1 } } },
    ]),
    Incident.find({ client: { $in: ids } })
      .sort({ startedAt: -1 })
      .limit(12)
      .lean(),
  ]);

  const byId = new Map(clients.map((c) => [String(c._id), c]));
  const all: HealthRow[] = clients
    .filter((c) => c.isDemo || c.website?.domain || c.website?.apiUrl)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      stage: c.website?.stage ?? "",
      domain: c.website?.domain ?? "",
      apiUrl: c.website?.apiUrl ?? "",
      health: toClientHealth(c.health),
      uptime7: { website: null, api: null },
      openIncidents: 0,
    }));
  const rowBySlug = new Map(all.map((r) => [r.slug, r]));
  for (const u of uptimes) {
    const row = rowBySlug.get(byId.get(u.client)?.slug ?? "");
    if (row) row.uptime7[u.target] = u.uptime.d7;
  }
  for (const o of open) {
    const row = rowBySlug.get(byId.get(String(o._id))?.slug ?? "");
    if (row) row.openIncidents = o.n;
  }

  const demoSlug = clients.find((c) => c.isDemo)?.slug;
  return {
    now,
    rows: all.filter((r) => r.slug !== demoSlug),
    demo: all.find((r) => r.slug === demoSlug) ?? null,
    incomplete: clients
      .filter((c) => c.website?.stage === "live" && !c.isDemo)
      .map((c) => ({
        slug: c.slug,
        name: c.name,
        missing: [
          !c.website?.domain && "domain",
          !c.website?.apiUrl && "API address",
        ].filter((m): m is string => !!m),
      }))
      .filter((c) => c.missing.length),
    incidents: latest.map((i) => {
      const c = byId.get(String(i.client));
      return {
        id: String(i._id),
        slug: c?.slug ?? "",
        name: c?.name ?? "Deleted client",
        target: i.target as HealthTarget,
        cause: i.cause ?? "",
        startedAt: new Date(i.startedAt).toISOString(),
        resolvedAt: i.resolvedAt ? new Date(i.resolvedAt).toISOString() : "",
      };
    }),
    channels: channelsConfigured(),
    schedule: process.env.VERCEL
      ? process.env.CRON_SECRET
        ? "on"
        : "missing-secret"
      : "local",
  };
}
