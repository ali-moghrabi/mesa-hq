import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Mail,
  MessageCircle,
  PencilLine,
  Siren,
  Timer,
} from "lucide-react";
import type { HealthOverview, HealthRow } from "@/lib/health/queries";
import {
  EXPIRY_WARN_DAYS,
  STATE_LABEL,
  STATE_TONE,
  ago,
  daysUntil,
  overallState,
  span,
  targetState,
  type OverallState,
  type TargetHealth,
} from "@/lib/health/state";
import { DemoCard } from "../demo/DemoCard";
import { CheckAllButton, TestAlertButton } from "./HealthActions";

const ORDER: Record<OverallState, number> = {
  down: 0,
  failing: 1,
  warning: 2,
  slow: 2,
  unknown: 3,
  up: 4,
  off: 5,
};

export function HealthView({
  data,
  today,
  now,
}: {
  data: HealthOverview;
  today: string;
  now: number;
}) {
  const rows = data.rows
    .map((r) => ({
      ...r,
      state: overallState(
        r.health,
        { website: !!r.domain, api: !!r.apiUrl },
        today,
      ),
    }))
    .sort(
      (a, b) => ORDER[a.state] - ORDER[b.state] || a.name.localeCompare(b.name),
    );

  const count = (states: OverallState[]) =>
    rows.filter((r) => states.includes(r.state)).length;
  const openIncidents = data.incidents.filter((i) => !i.resolvedAt).length;
  const demo = data.demo;
  const lastRound = [...rows, ...(demo ? [demo] : [])]
    .map((r) => r.health.checkedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Monitoring</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Health</h1>
          <p className="mt-1.5 text-muted-foreground">
            Every live client&apos;s website and API, checked every 5 minutes.
            {lastRound && <> Last round {ago(lastRound, now)}.</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TestAlertButton />
          <CheckAllButton />
        </div>
      </div>

      {demo && (
        <DemoCard
          name={demo.name}
          slug={demo.slug}
          domain={demo.domain}
          state={overallState(
            demo.health,
            { website: !!demo.domain, api: !!demo.apiUrl },
            today,
          )}
          health={demo.health}
          uptime7={demo.uptime7}
          monitored={{ website: !!demo.domain, api: !!demo.apiUrl }}
          today={today}
          now={now}
        />
      )}

      {/* Numbers */}
      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          icon={<CheckCircle2 />}
          label="Up"
          value={count(["up"])}
          note={`of ${rows.length} monitored`}
        />
        <Tile
          icon={<Siren />}
          label="Down"
          value={count(["down", "failing"])}
          note={count(["down", "failing"]) ? "Needs a look" : "All answering"}
          tone={
            count(["down"]) ? "danger" : count(["failing"]) ? "warn" : undefined
          }
        />
        <Tile
          icon={<AlertTriangle />}
          label="Warnings"
          value={count(["warning"])}
          note="Slow, or a renewal is near"
          tone={count(["warning"]) ? "warn" : undefined}
        />
        <Tile
          icon={<Activity />}
          label="Open incidents"
          value={openIncidents}
          note={
            data.incidents.length
              ? `${data.incidents.length} in the latest list`
              : "None yet"
          }
          tone={openIncidents ? "danger" : undefined}
        />
      </section>

      {/* Alerts setup */}
      <section className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3">
        <Setup
          icon={<MessageCircle />}
          title="WhatsApp alerts"
          on={data.channels.whatsapp}
          onText="Sent with CallMeBot to your number"
          offText="Add CALLMEBOT_PHONE and CALLMEBOT_API_KEY"
        />
        <Setup
          icon={<Mail />}
          title="Email alerts"
          on={data.channels.email}
          onText="Sent through your SMTP account"
          offText="Add the SMTP settings and ALERT_EMAIL"
        />
        <Setup
          icon={<Timer />}
          title="Schedule"
          on={data.schedule === "on"}
          onText="Vercel runs the checks every 5 minutes"
          offText={
            data.schedule === "missing-secret"
              ? "Add CRON_SECRET in Vercel's settings, then redeploy"
              : "Not deployed: run npm run health -- --watch"
          }
        />
      </section>

      {/* Clients */}
      {rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-strong px-6 py-14 text-center">
          <CircleDashed className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 font-semibold">Nothing to monitor yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            A client is checked once its website stage is Live and it has a
            domain or an API address. Add them from the client&apos;s edit page.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-4 border-b border-border px-5 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase lg:grid">
            <span>Client</span>
            <span>Website</span>
            <span>API &amp; database</span>
            <span>Renewals</span>
            <span className="text-right">Checked</span>
          </div>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <Row key={r.slug} row={r} today={today} now={now} />
            ))}
          </ul>
        </div>
      )}

      {data.incomplete.length > 0 && (
        <section className="mt-4 rounded-2xl border border-accent/25 bg-accent/6 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-accent">
            <AlertTriangle className="size-4" /> Live but not fully checked
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {data.incomplete.map((c) => (
              <li key={c.slug} className="flex flex-wrap items-center gap-x-2">
                <Link
                  href={`/clients/${c.slug}`}
                  className="font-medium hover:text-primary"
                >
                  {c.name}
                </Link>
                <span className="text-muted-foreground">
                  is missing its {c.missing.join(" and ")}
                </span>
                <Link
                  href={`/clients/edit/${c.slug}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <PencilLine className="size-3.5" /> Add
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Incidents */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Clock3 className="size-4 text-primary" /> Recent incidents
        </h2>
        {data.incidents.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No incidents. When a site or an API stays down for two checks in a
            row, it shows here and you get an alert.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {data.incidents.map((i) => (
              <li
                key={i.id}
                className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`size-2 shrink-0 rounded-full ${i.resolvedAt ? "bg-border-strong" : "animate-pulse bg-destructive"}`}
                  />
                  <Link
                    href={`/clients/${i.slug}`}
                    className="shrink-0 font-medium hover:text-primary"
                  >
                    {i.name}
                  </Link>
                  <span className="shrink-0 text-muted-foreground">
                    · {i.target === "website" ? "Website" : "API"}
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
        )}
      </section>
    </>
  );
}

/* ───────────── one client ───────────── */

function Row({
  row: r,
  today,
  now,
}: {
  row: HealthRow & { state: OverallState };
  today: string;
  now: number;
}) {
  const tone = STATE_TONE[r.state];
  const ssl = daysUntil(r.health.sslExpiresAt, today);
  const domain = daysUntil(r.health.domainExpiresAt, today);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-3 px-5 py-4 transition-colors hover:bg-elevated/40 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/clients/${r.slug}`}
            className="truncate font-semibold transition-colors hover:text-primary"
          >
            {r.name}
          </Link>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone.pill}`}
          >
            <span
              className={`size-1.5 rounded-full ${tone.dot} ${r.state === "down" ? "animate-pulse" : ""}`}
            />
            {STATE_LABEL[r.state]}
          </span>
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
          {r.domain || "no domain"}
          {r.stage !== "live" && (
            <span className="ml-2 font-sans">· not live (checked by hand)</span>
          )}
        </p>
      </div>
      <Target
        label="Website"
        on={!!r.domain}
        t={r.health.website}
        uptime={r.uptime7.website}
      />
      <Target
        label="API"
        on={!!r.apiUrl}
        t={r.health.api}
        uptime={r.uptime7.api}
      />
      <div className="text-xs text-muted-foreground max-lg:flex max-lg:gap-4">
        <Renewal label="SSL" days={ssl} error={r.health.sslError} />
        <Renewal label="Domain" days={domain} />
      </div>
      <p className="text-xs text-muted-foreground lg:text-right">
        {r.health.checkedAt ? ago(r.health.checkedAt, now) : "Not checked yet"}
        {r.openIncidents > 0 && (
          <span className="block font-medium text-destructive">
            {r.openIncidents} open incident{r.openIncidents === 1 ? "" : "s"}
          </span>
        )}
      </p>
    </li>
  );
}

const DOT: Record<string, string> = {
  up: "bg-success",
  slow: "bg-accent",
  failing: "bg-accent",
  down: "bg-destructive",
  unknown: "bg-muted-foreground/50",
};

function Target({
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
  if (!on)
    return (
      <p className="text-sm text-muted-foreground">
        <span className="lg:hidden">{label}: </span>not set
      </p>
    );
  const state = targetState(t);
  return (
    <div className="min-w-0 text-sm">
      <p className="flex items-center gap-2">
        <span className={`size-2 shrink-0 rounded-full ${DOT[state]}`} />
        <span className="lg:hidden text-muted-foreground">{label}</span>
        <span className="font-medium">
          {state === "unknown"
            ? "Not checked"
            : t.ok
              ? `${t.ms} ms`
              : state === "down"
                ? "Down"
                : "Failing"}
        </span>
        {uptime !== null && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {uptime}% · 7 d
          </span>
        )}
      </p>
      {!t.ok && t.error && (
        <p className="mt-0.5 truncate text-xs text-destructive" title={t.error}>
          {t.error}
        </p>
      )}
    </div>
  );
}

function Renewal({
  label,
  days,
  error,
}: {
  label: string;
  days: number | null;
  error?: string;
}) {
  const warn = !!error || (days !== null && days <= EXPIRY_WARN_DAYS);
  return (
    <p className={warn ? "font-medium text-accent" : ""}>
      {label}:{" "}
      {error
        ? "not trusted"
        : days === null
          ? "—"
          : days < 0
            ? "expired"
            : `${days} days`}
    </p>
  );
}

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Beirut",
  }).format(new Date(iso));

function Tile({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  note: string;
  tone?: "danger" | "warn";
}) {
  const color =
    tone === "danger"
      ? "bg-destructive/12 text-destructive"
      : tone === "warn"
        ? "bg-accent/12 text-accent"
        : "bg-primary/12 text-primary";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <span
        className={`grid size-9 place-items-center rounded-xl [&_svg]:size-4.5 ${color}`}
      >
        {icon}
      </span>
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-2xl font-semibold tracking-tight tabular-nums ${tone === "danger" ? "text-destructive" : ""}`}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Setup({
  icon,
  title,
  on,
  onText,
  offText,
}: {
  icon: ReactNode;
  title: string;
  on: boolean;
  onText: string;
  offText: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
      <span className="mt-0.5 text-muted-foreground [&_svg]:size-4.5">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium">
          {title}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
              on
                ? "bg-success/12 text-success"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {on ? "On" : "Off"}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {on ? onText : offText}
        </p>
      </div>
    </div>
  );
}
