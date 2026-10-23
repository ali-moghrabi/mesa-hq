import type { Types } from "mongoose";
import { connectDb } from "../db";
import { todayIn } from "../clients/list";
import { Client } from "../models/client";
import { HealthCheck, Incident, type HealthTarget } from "../models/health";
import { sendAlert, type Alert, type ChannelResult } from "./notify";
import {
  probeApi,
  probeCertificate,
  probeDomain,
  probeWebsite,
  type ProbeResult,
} from "./probe";
import {
  EXPIRY_WARN_DAYS,
  FAIL_THRESHOLD,
  daysUntil,
  overallState,
  toClientHealth,
  type OverallState,
} from "./state";

const EXPIRY_EVERY_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 5;

type Stored = {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  isDemo?: boolean;
  website?: { stage?: string; domain?: string; apiUrl?: string };
  health?: {
    website?: Record<string, unknown>;
    api?: Record<string, unknown>;
    expiryCheckedAt?: Date | null;
    sslWarnedFor?: string;
    domainWarnedFor?: string;
  };
};

export type ClientRunResult = {
  slug: string;
  name: string;
  state: OverallState;
  website?: ProbeResult;
  api?: ProbeResult;
  alerts: ChannelResult[];
};

export type RunSummary = {
  checked: number;
  down: number;
  ms: number;
  results: ClientRunResult[];
};

export async function runHealthChecks({
  slugs,
  forceExpiry = false,
}: {
  slugs?: string[];
  forceExpiry?: boolean;
} = {}): Promise<RunSummary> {
  const started = Date.now();
  await connectDb();

  const filter: Record<string, unknown> = slugs
    ? { slug: { $in: slugs } }
    : {
        $and: [
          { $or: [{ "website.stage": "live" }, { isDemo: true }] },
          {
            $or: [
              { "website.domain": { $nin: ["", null] } },
              { "website.apiUrl": { $nin: ["", null] } },
            ],
          },
        ],
      };
  const clients = await Client.find(filter, {
    name: 1,
    slug: 1,
    isDemo: 1,
    website: 1,
    health: 1,
  }).lean<Stored[]>();

  const results: ClientRunResult[] = [];
  for (let i = 0; i < clients.length; i += CONCURRENCY) {
    const batch = clients.slice(i, i + CONCURRENCY);
    results.push(
      ...(await Promise.all(batch.map((c) => checkClient(c, forceExpiry)))),
    );
  }

  return {
    checked: results.length,
    down: results.filter((r) => r.state === "down").length,
    ms: Date.now() - started,
    results,
  };
}

async function checkClient(
  c: Stored,
  forceExpiry: boolean,
): Promise<ClientRunResult> {
  const now = new Date();
  const today = todayIn();
  const domain = c.website?.domain?.trim() ?? "";
  const apiUrl = c.website?.apiUrl?.trim() ?? "";
  // Incidents and alerts: live clients and the demo
  const live = c.website?.stage === "live" || !!c.isDemo;

  const [website, api] = await Promise.all([
    domain ? probeWebsite(`https://${domain}`) : undefined,
    apiUrl ? probeApi(apiUrl) : undefined,
  ]);

  const probes = [
    ["website", website],
    ["api", api],
  ] as const;
  const checked = probes.filter(
    (p): p is readonly [HealthTarget, ProbeResult] => !!p[1],
  );

  // Every result is kept 30 days (uptime % and history)
  if (checked.length)
    await HealthCheck.insertMany(
      checked.map(([target, r]) => ({
        client: c._id,
        target,
        ok: r.ok,
        status: r.status,
        ms: r.ms,
        error: r.error,
        at: now,
      })),
    );

  const set: Record<string, unknown> = { "health.checkedAt": now };
  const wentDown: { target: HealthTarget; result: ProbeResult; since: Date }[] =
    [];
  const cameBack: { target: HealthTarget; downSince: Date | null }[] = [];

  for (const [target, r] of checked) {
    const prev = c.health?.[target] ?? {};
    const prevOk = typeof prev.ok === "boolean" ? prev.ok : null;
    const prevSince = prev.since instanceof Date ? prev.since : null;
    const wasDown = !!prev.down;
    const failures = r.ok ? 0 : Number(prev.failures ?? 0) + 1;
    const down = !r.ok && (wasDown || failures >= FAIL_THRESHOLD);
    // "since" = when it last switched between answering and not answering
    const since = prevOk === r.ok && prevSince ? prevSince : now;

    set[`health.${target}`] = {
      ok: r.ok,
      status: r.status,
      ms: r.ms,
      error: r.error,
      failures,
      down: live ? down : false,
      since,
      checkedAt: now,
    };

    if (!live) continue;
    if (down && !wasDown) wentDown.push({ target, result: r, since });
    if (r.ok && wasDown) cameBack.push({ target, downSince: prevSince });
  }

  // Targets no longer configured (domain or API address removed): forget their state
  for (const [target, r] of probes)
    if (!r && c.health?.[target]?.checkedAt) set[`health.${target}`] = {};

  // Certificates and domains: once a day
  const warnings: string[] = [];
  const lastExpiry = c.health?.expiryCheckedAt;
  if (
    domain &&
    (forceExpiry ||
      !lastExpiry ||
      now.getTime() - new Date(lastExpiry).getTime() > EXPIRY_EVERY_MS)
  ) {
    const host = domain.replace(/:\d+$/, "");
    const [cert, reg] = await Promise.all([
      probeCertificate(host),
      probeDomain(host),
    ]);
    set["health.sslExpiresAt"] = cert.expiresAt;
    // Only a bad certificate is a problem here: no answer at all shows on the website check
    set["health.sslError"] = cert.error.startsWith("Certificate")
      ? cert.error
      : "";
    set["health.domainExpiresAt"] = reg.expiresAt;
    set["health.expiryCheckedAt"] = now;

    const sslDays = daysUntil(cert.expiresAt, today);
    if (
      live &&
      sslDays !== null &&
      sslDays <= EXPIRY_WARN_DAYS &&
      c.health?.sslWarnedFor !== cert.expiresAt
    ) {
      warnings.push(
        `SSL certificate ${sslDays < 0 ? "expired" : "expires"} ${dayWords(sslDays)} (${cert.expiresAt}). Vercel renews it by itself: if it doesn't, check the domain's DNS in Vercel.`,
      );
      set["health.sslWarnedFor"] = cert.expiresAt;
    }
    const domainDays = daysUntil(reg.expiresAt, today);
    if (
      live &&
      domainDays !== null &&
      domainDays <= EXPIRY_WARN_DAYS &&
      c.health?.domainWarnedFor !== reg.expiresAt
    ) {
      warnings.push(
        `Domain ${registrable(host)} ${domainDays < 0 ? "expired" : "expires"} ${dayWords(domainDays)} (${reg.expiresAt}). Renew it at the registrar.`,
      );
      set["health.domainWarnedFor"] = reg.expiresAt;
    }
  }

  await Client.updateOne({ _id: c._id }, { $set: set });

  // Incidents
  for (const d of wentDown)
    await Incident.create({
      client: c._id,
      target: d.target,
      cause: d.result.error,
      startedAt: d.since,
    });
  for (const b of cameBack)
    await Incident.updateMany(
      { client: c._id, target: b.target, resolvedAt: null },
      { $set: { resolvedAt: now } },
    );

  // Alerts: at most one per kind per client per round
  const alerts: ChannelResult[] = [];
  const path = `/clients/${c.slug}`;
  if (wentDown.length)
    alerts.push(
      ...(await sendAlert(downAlert(c.name, domain, wentDown, path))),
    );
  if (cameBack.length)
    alerts.push(...(await sendAlert(upAlert(c.name, cameBack, now, path))));
  if (warnings.length)
    alerts.push(
      ...(await sendAlert({
        tone: "warning",
        title: `${c.name}: renewal coming up`,
        lines: warnings,
        path,
      })),
    );

  // The state after this round, for the caller
  const fresh = await Client.findById(c._id, {
    health: 1,
    website: 1,
  }).lean<Stored>();
  return {
    slug: c.slug,
    name: c.name,
    state: overallState(
      toClientHealth(fresh?.health),
      { website: !!domain, api: !!apiUrl },
      today,
    ),
    website,
    api,
    alerts,
  };
}

/* ───────────── alert texts ───────────── */

const LABEL: Record<HealthTarget, string> = { website: "Website", api: "API" };

const time = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Beirut",
  }).format(d);

function duration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

const dayWords = (days: number) =>
  days === 0
    ? "today"
    : days > 0
      ? `in ${days} day${days === 1 ? "" : "s"}`
      : `${-days} day${days === -1 ? "" : "s"} ago`;

const registrable = (host: string) => host.replace(/^www\./, "");

function downAlert(
  name: string,
  domain: string,
  down: { target: HealthTarget; result: ProbeResult; since: Date }[],
  path: string,
): Alert {
  const websiteDown = down.some((d) => d.target === "website");
  const first = down.reduce((a, b) => (a.since < b.since ? a : b));
  return {
    tone: "down",
    title: websiteDown ? `${name} is down` : `${name}: the API is down`,
    lines: [
      ...down.map((d) => `${LABEL[d.target]}: ${d.result.error}`),
      `Since ${time(first.since)} (Beirut time)`,
      ...(websiteDown && domain ? [`https://${domain}`] : []),
      websiteDown
        ? "Guests can't open the site right now."
        : "The site opens, but orders, bookings and sign-in won't work.",
    ],
    path,
  };
}

function upAlert(
  name: string,
  back: { target: HealthTarget; downSince: Date | null }[],
  now: Date,
  path: string,
): Alert {
  return {
    tone: "up",
    title: `${name} is back up`,
    lines: back.map(
      (b) =>
        `${LABEL[b.target]} answers again${b.downSince ? `, after ${duration(now.getTime() - b.downSince.getTime())} down` : ""}.`,
    ),
    path,
  };
}
