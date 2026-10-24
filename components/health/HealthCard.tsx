import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  CircleAlert,
  Globe,
  Lock,
  PencilLine,
  Server,
  ShieldCheck,
} from "lucide-react";
import type { HealthDetail, Slot, Uptime } from "@/lib/health/queries";
import {
  EXPIRY_WARN_DAYS,
  STATE_LABEL,
  STATE_TONE,
  ago,
  daysUntil,
  overallState,
  span,
  targetState,
  type TargetHealth,
  type TargetState,
} from "@/lib/health/state";
import { CheckNowButton } from "./HealthActions";

export function HealthCard({
  slug,
  live,
  detail,
  today,
  now,
}: {
  slug: string;
  live: boolean;
  detail: HealthDetail;
  today: string;
  now: number;
}) {
  const { health, monitored } = detail;
  const state = overallState(health, monitored, today);
  const tone = STATE_TONE[state];
  const nothing = !monitored.website && !monitored.api;

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Activity className="size-4 text-primary" /> Health
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone.pill}`}
          >
            <span
              className={`size-1.5 rounded-full ${tone.dot} ${state === "down" ? "animate-pulse" : ""}`}
            />
            {STATE_LABEL[state]}
          </span>
          {health.checkedAt && (
            <span className="text-xs text-muted-foreground">
              Checked {ago(health.checkedAt, now)}
            </span>
          )}
        </div>
        {!nothing && <CheckNowButton slug={slug} />}
      </div>

      {nothing ? (
        <div className="mt-5 flex flex-col items-start gap-3 rounded-xl border border-dashed border-border-strong px-4 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            Add the client&apos;s{" "}
            <span className="text-foreground">domain</span> and{" "}
            <span className="text-foreground">API address</span> to start
            checking their website.
          </p>
          <Link
            href={`/clients/edit/${slug}`}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 font-medium text-foreground hover:bg-muted"
          >
            <PencilLine className="size-4" /> Add them
          </Link>
        </div>
      ) : (
        <>
          {!live && (
            <p className="mt-4 rounded-xl border border-border bg-elevated/50 px-3.5 py-2.5 text-xs text-muted-foreground">
              Automatic checks and alerts start when the website stage is{" "}
              <span className="text-foreground">Live</span>. You can check it by
              hand meanwhile.
            </p>
          )}

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            <TargetPanel
              icon={<Globe />}
              title="Website"
              monitored={monitored.website}
              target={health.website}
              uptime={detail.uptime.website}
              bars={detail.bars.website}
              missing="Add the domain to check the website."
              slug={slug}
              now={now}
            />
            <TargetPanel
              icon={<Server />}
              title="API & database"
              monitored={monitored.api}
              target={health.api}
              uptime={detail.uptime.api}
              bars={detail.bars.api}
              missing="Add the API address to check orders, bookings and the database."
              slug={slug}
              now={now}
            />
          </div>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
            <Expiry
              icon={<Lock />}
              label="SSL certificate"
              date={health.sslExpiresAt}
              error={health.sslError}
              unknown={
                monitored.website
                  ? health.expiryCheckedAt
                    ? "Couldn't be read"
                    : "Read on the next check"
                  : "No domain"
              }
              today={today}
            />
            <Expiry
              icon={<ShieldCheck />}
              label="Domain registration"
              date={health.domainExpiresAt}
              unknown={
                monitored.website
                  ? health.expiryCheckedAt
                    ? "Not published by the registry"
                    : "Read on the next check"
                  : "No domain"
              }
              today={today}
            />
            <div className="rounded-xl border border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Incidents (30 days)
              </p>
              <p className="mt-1 text-sm font-medium">
                {(() => {
                  const recent = detail.incidents.filter(
                    (i) =>
                      now - new Date(i.startedAt).getTime() < 30 * 86_400_000,
                  );
                  const open = recent.filter((i) => !i.resolvedAt).length;
                  return recent.length === 0
                    ? "None"
                    : `${recent.length}${open ? `, ${open} open` : ""}`;
                })()}
              </p>
            </div>
          </div>

          {detail.incidents.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Recent incidents
              </h3>
              <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
                {detail.incidents.slice(0, 5).map((i) => (
                  <li
                    key={i.id}
                    className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`size-2 shrink-0 rounded-full ${i.resolvedAt ? "bg-border-strong" : "animate-pulse bg-destructive"}`}
                      />
                      <span className="font-medium">
                        {i.target === "website" ? "Website" : "API"}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {i.cause}
                      </span>
                    </div>
                    <span className="shrink-0 pl-4.5 text-xs text-muted-foreground sm:pl-0">
                      {when(i.startedAt)} ·{" "}
                      {i.resolvedAt ? (
                        `down ${span(new Date(i.resolvedAt).getTime() - new Date(i.startedAt).getTime())}`
                      ) : (
                        <span className="font-medium text-destructive">
                          ongoing, {span(now - new Date(i.startedAt).getTime())}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ───────────── pieces ───────────── */

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Beirut",
  }).format(new Date(iso));

const TARGET_WORD: Record<TargetState, string> = {
  up: "Up",
  slow: "Slow",
  failing: "Failing",
  down: "Down",
  unknown: "Not checked yet",
};

const TARGET_TONE: Record<TargetState, string> = {
  up: "bg-success",
  slow: "bg-accent",
  failing: "bg-accent",
  down: "bg-destructive",
  unknown: "bg-muted-foreground/50",
};

const SLOT_TONE: Record<Slot, string> = {
  ok: "bg-success/70",
  slow: "bg-accent/80",
  fail: "bg-destructive",
  none: "bg-muted",
};

function TargetPanel({
  icon,
  title,
  monitored,
  target,
  uptime,
  bars,
  missing,
  slug,
  now,
}: {
  icon: ReactNode;
  title: string;
  monitored: boolean;
  target: TargetHealth;
  uptime: Uptime;
  bars: Slot[];
  missing: string;
  slug: string;
  now: number;
}) {
  if (!monitored)
    return (
      <div className="flex flex-col justify-center rounded-xl border border-dashed border-border-strong px-4 py-5 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground [&_svg]:size-4 [&_svg]:text-muted-foreground">
          {icon} {title}
        </p>
        <p className="mt-1.5">{missing}</p>
        <Link
          href={`/clients/edit/${slug}`}
          className="mt-3 text-sm font-medium text-primary hover:underline"
        >
          Edit the client
        </Link>
      </div>
    );

  const state = targetState(target);
  return (
    <div className="rounded-xl border border-border bg-elevated/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium [&_svg]:size-4 [&_svg]:text-muted-foreground">
            {icon} {title}
          </p>
          <p className="mt-2 flex items-center gap-2 text-lg font-semibold">
            <span
              className={`size-2.5 rounded-full ${TARGET_TONE[state]} ${state === "down" ? "animate-pulse" : ""}`}
            />
            {TARGET_WORD[state]}
            {target.ok && (
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                {target.ms} ms
              </span>
            )}
          </p>
        </div>
        {target.since && state !== "unknown" && (
          <p className="text-right text-xs text-muted-foreground">
            {target.ok ? "Up for" : "Down for"}
            <span className="block font-medium text-foreground">
              {span(now - new Date(target.since).getTime())}
            </span>
          </p>
        )}
      </div>

      {!target.ok && target.error && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          <CircleAlert className="mt-px size-3.5 shrink-0" /> {target.error}
          {state === "failing" && " (one more failure and you get an alert)"}
        </p>
      )}

      <div className="mt-4">
        <div
          className="flex h-7 items-end gap-0.5"
          role="img"
          aria-label={`Last 24 hours: ${bars.filter((b) => b === "fail").length} half-hours with failures`}
        >
          {bars.map((b, i) => (
            <span
              key={i}
              className={`h-full min-w-0 flex-1 rounded-xs ${SLOT_TONE[b]}`}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
          <span>24 h ago</span>
          <span>now</span>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 text-center">
        <Figure label="24 h" value={percent(uptime.d1)} />
        <Figure label="7 days" value={percent(uptime.d7)} />
        <Figure label="30 days" value={percent(uptime.d30)} />
        <Figure
          label="Avg speed"
          value={uptime.avgMs === null ? "—" : `${uptime.avgMs} ms`}
        />
      </dl>
    </div>
  );
}

const percent = (v: number | null) =>
  v === null ? "—" : `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}%`;

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dd className="truncate text-sm font-semibold tabular-nums">{value}</dd>
      <dt className="mt-0.5 text-[11px] text-muted-foreground">{label}</dt>
    </div>
  );
}

function Expiry({
  icon,
  label,
  date,
  error,
  unknown,
  today,
}: {
  icon: ReactNode;
  label: string;
  date: string;
  error?: string;
  unknown: string;
  today: string;
}) {
  const days = daysUntil(date, today);
  const warn = error || (days !== null && days <= EXPIRY_WARN_DAYS);
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${warn ? "border-accent/30 bg-accent/8" : "border-border"}`}
    >
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon} {label}
      </p>
      <p className={`mt-1 text-sm font-medium ${warn ? "text-accent" : ""}`}>
        {error ? (
          error
        ) : days === null ? (
          <span className="font-normal text-muted-foreground">{unknown}</span>
        ) : days < 0 ? (
          `Expired ${-days} days ago`
        ) : (
          `Expires in ${days} day${days === 1 ? "" : "s"}`
        )}
      </p>
      {days !== null && !error && (
        <p className="text-xs text-muted-foreground">{date}</p>
      )}
    </div>
  );
}
