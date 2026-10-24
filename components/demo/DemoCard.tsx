import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  ExternalLink,
  LayoutDashboard,
  Pin,
  Sparkles,
} from "lucide-react";
import type { HealthTarget } from "@/lib/models/health";
import {
  EXPIRY_WARN_DAYS,
  STATE_LABEL,
  STATE_TONE,
  ago,
  daysUntil,
  targetState,
  type ClientHealth,
  type OverallState,
  type TargetHealth,
} from "@/lib/health/state";

export function DemoCard({
  name,
  slug,
  domain,
  state,
  health,
  uptime7,
  monitored,
  today,
  now,
}: {
  name: string;
  slug: string;
  domain: string;
  state: OverallState;
  health?: ClientHealth;
  uptime7?: Record<HealthTarget, number | null>;
  monitored?: Record<HealthTarget, boolean>;
  today?: string;
  now?: number;
}) {
  const site = domain ? `https://${domain}` : null;
  const tone = STATE_TONE[state];

  return (
    <section
      aria-label="MESA Demo"
      className="relative mt-6 overflow-hidden rounded-3xl border border-primary/35 bg-card shadow-[0_30px_80px_-40px_var(--primary)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_45%,color-mix(in_srgb,var(--highlight)_10%,transparent))]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -left-10 size-64 rounded-full bg-primary/20 blur-[80px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mask-[linear-gradient(to_left,black,transparent_70%)] bg-[radial-gradient(color-mix(in_srgb,var(--foreground)_14%,transparent)_1px,transparent_1px)] bg-size-[16px_16px]"
      />

      <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(140deg,var(--primary),var(--highlight))] text-xl font-extrabold text-primary-foreground shadow-[0_14px_36px_-12px_var(--primary)]">
            M
            <Sparkles className="absolute -top-1.5 -right-1.5 size-4.5 rounded-full bg-card p-0.5 text-accent" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              <Pin className="size-3.5 rotate-45" /> Pinned
              <span className="rounded-full border border-primary/40 bg-primary/12 px-2 py-0.5 text-[10px] tracking-[0.12em]">
                Showcase
              </span>
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {name}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>What restaurants see, and where you test.</span>
              {site && (
                <a
                  href={site}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-foreground/80 transition-colors hover:text-primary"
                >
                  {domain}
                </a>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {state !== "off" && (
            <span
              className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium ${tone.pill}`}
              title={
                health?.checkedAt && now
                  ? `Checked ${ago(health.checkedAt, now)}`
                  : undefined
              }
            >
              <span
                className={`size-2 rounded-full ${tone.dot} ${state === "down" ? "animate-pulse" : ""}`}
              />
              {STATE_LABEL[state]}
            </span>
          )}
          {site && (
            <>
              <DemoLink href={site} external icon={<ExternalLink />}>
                Visit
              </DemoLink>
              <DemoLink
                href={`${site}/admin`}
                external
                icon={<LayoutDashboard />}
              >
                Admin
              </DemoLink>
            </>
          )}
          <Link
            href={`/clients/${slug}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_14px_30px_-14px_var(--primary)] transition-all hover:brightness-110 active:translate-y-px"
          >
            Open <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>

      {health && monitored && today && (
        <div className="relative grid grid-cols-[minmax(0,1fr)] gap-px border-t border-primary/20 bg-primary/15 sm:grid-cols-3">
          <Mini
            label="Website"
            on={monitored.website}
            t={health.website}
            uptime={uptime7?.website ?? null}
          />
          <Mini
            label="API & database"
            on={monitored.api}
            t={health.api}
            uptime={uptime7?.api ?? null}
          />
          <div className="bg-card/95 px-5 py-3.5">
            <p className="text-xs text-muted-foreground">Renewals</p>
            <p className="mt-1 text-sm font-medium">
              <Days label="SSL" date={health.sslExpiresAt} today={today} />
              <span className="mx-2 text-border-strong">·</span>
              <Days
                label="Domain"
                date={health.domainExpiresAt}
                today={today}
              />
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function DemoLink({
  href,
  icon,
  external,
  children,
}: {
  href: string;
  icon: ReactNode;
  external?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      {...(external && { target: "_blank", rel: "noreferrer" })}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-primary/25 bg-background/40 px-3.5 text-sm font-medium backdrop-blur transition-colors hover:border-primary/50 hover:bg-primary/10 [&_svg]:size-4 [&_svg]:text-primary"
    >
      {icon}
      {children}
    </a>
  );
}

const DOT: Record<string, string> = {
  up: "bg-success",
  slow: "bg-accent",
  failing: "bg-accent",
  down: "bg-destructive",
  unknown: "bg-muted-foreground/50",
};

function Mini({
  label,
  on,
  t,
  uptime,
}: {
  label: string;
  on: boolean;
  t: TargetHealth;
  uptime: number | null;
}) {
  const state = targetState(t);
  return (
    <div className="min-w-0 bg-card/95 px-5 py-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {on ? (
        <>
          <p className="mt-1 flex items-center gap-2 text-sm font-medium">
            <span className={`size-2 shrink-0 rounded-full ${DOT[state]}`} />
            {state === "unknown"
              ? "Not checked yet"
              : t.ok
                ? `${t.ms} ms`
                : state === "down"
                  ? "Down"
                  : "Failing"}
            {uptime !== null && (
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {uptime}% · 7 days
              </span>
            )}
          </p>
          {!t.ok && t.error && (
            <p
              className="mt-0.5 truncate text-xs text-destructive"
              title={t.error}
            >
              {t.error}
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Not set</p>
      )}
    </div>
  );
}

function Days({
  label,
  date,
  today,
}: {
  label: string;
  date: string;
  today: string;
}) {
  const days = daysUntil(date, today);
  const warn = days !== null && days <= EXPIRY_WARN_DAYS;
  return (
    <span className={warn ? "text-accent" : ""}>
      {label}{" "}
      <span className="font-normal text-muted-foreground">
        {days === null ? "—" : days < 0 ? "expired" : `${days} d`}
      </span>
    </span>
  );
}
