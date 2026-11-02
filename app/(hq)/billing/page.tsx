import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CircleCheck,
  CreditCard,
  ExternalLink,
  HandCoins,
  PauseCircle,
  Receipt,
  TrendingUp,
  Zap,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { todayIn } from "@/lib/clients/list";
import { cycleOf } from "@/lib/clients/options";
import {
  daysBetween,
  longDate,
  methodLabel,
  money,
  relativeDays,
} from "@/lib/clients/detail";
import { billingOverview, type DueRow } from "@/lib/billing/queries";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

const sum = (list: { currency: string; amount: number }[]) =>
  list.length
    ? list.map((m) => money(m.amount, m.currency)).join(" + ")
    : money(0, "USD");

export default async function BillingPage() {
  await requireAdmin();
  const data = await billingOverview();
  const today = todayIn();

  return (
    <>
      <p className="text-sm font-medium text-primary">Billing</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Subscriptions & payments
      </h1>
      <p className="mt-1.5 text-muted-foreground">
        What comes in every month, what&apos;s due, and what needs you.
      </p>

      <StripeStatus stripe={data.stripe} />

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={<TrendingUp />}
          label="Monthly recurring"
          value={sum(data.mrr)}
          note="Active clients, per month"
        />
        <Stat
          icon={<Receipt />}
          label="Collected, 30 days"
          value={sum(data.collected30)}
          note="Stripe and by hand"
        />
        <Stat
          icon={<Zap />}
          label="Automatic"
          value={String(data.counts.automatic)}
          note={`${data.counts.manual} billed by hand`}
        />
        <Stat
          icon={
            data.counts.failing + data.counts.overdue ? (
              <AlertTriangle />
            ) : (
              <CircleCheck />
            )
          }
          label="Need you"
          value={String(data.counts.failing + data.counts.overdue)}
          note={`${data.counts.failing} failed · ${data.counts.overdue} overdue · ${data.counts.paused} paused`}
          tone={
            data.counts.failing + data.counts.overdue ? "danger" : undefined
          }
        />
      </section>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-2">
        <Panel
          icon={<AlertTriangle />}
          title="Needs attention"
          empty="All good: no failed or overdue payments."
          rows={[...data.failing, ...data.overdue]}
          render={(r) => (
            <DueLine
              key={r.slug}
              row={r}
              tone="danger"
              note={
                r.status === "past_due"
                  ? r.error || "The card charge failed"
                  : `Overdue since ${longDate(r.nextBillingDate)}, record it once they pay`
              }
            />
          )}
        />
        <Panel
          icon={<CalendarClock />}
          title="Coming up · 14 days"
          empty="Nothing due in the next two weeks."
          rows={data.upcoming}
          render={(r) => (
            <DueLine
              key={r.slug}
              row={r}
              note={`${relativeDays(daysBetween(today, r.nextBillingDate)).replace(/^./, (c) => c.toUpperCase())}${
                r.billingMode === "stripe"
                  ? ` · charged by Stripe${r.card ? ` (${r.card})` : ""}`
                  : " · to collect by hand"
              }`}
            />
          )}
        />
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold [&_svg]:size-4 [&_svg]:text-primary">
          <Receipt /> Latest payments
        </h2>
        {data.recent.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted-foreground">
            No payments yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data.recent.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-4 ${
                    p.source === "stripe"
                      ? "bg-primary/12 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {p.source === "stripe" ? <CreditCard /> : <HandCoins />}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/clients/${p.slug}`}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {p.clientName || p.slug}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "Asia/Beirut",
                    }).format(new Date(p.paidAt))}{" "}
                    · {p.kind === "setup" ? "Setup fee" : "Subscription"} ·{" "}
                    {p.source === "stripe"
                      ? "Card, by Stripe"
                      : methodLabel(p.method)}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {money(p.amount, p.currency)}
                </span>
                {p.invoiceUrl && (
                  <a
                    href={p.invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open the invoice"
                    className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function StripeStatus({
  stripe,
}: {
  stripe: { configured: boolean; test: boolean; webhook: boolean };
}) {
  if (stripe.configured && stripe.webhook && !stripe.test) return null;
  const missing = [
    !stripe.configured && "STRIPE_SECRET_KEY",
    !stripe.webhook && "STRIPE_WEBHOOK_SECRET",
  ].filter(Boolean);
  return (
    <p
      className={`mt-6 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
        missing.length
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-primary/30 bg-primary/10 text-primary"
      }`}
    >
      {missing.length ? (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      ) : (
        <PauseCircle className="mt-0.5 size-4 shrink-0" />
      )}
      <span>
        {missing.length
          ? `Automatic billing is off until ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} set in HQ's environment. Manual billing works meanwhile.`
          : "Stripe is in test mode: cards aren't really charged. Switch to the live key when you're ready."}
      </span>
    </p>
  );
}

function Stat({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  tone?: "danger";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span
          className={`grid size-8 place-items-center rounded-lg [&_svg]:size-4 ${
            tone
              ? "bg-destructive/12 text-destructive"
              : "bg-primary/12 text-primary"
          }`}
        >
          {icon}
        </span>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p
        className={`mt-3 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl ${tone ? "text-destructive" : ""}`}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Panel({
  icon,
  title,
  empty,
  rows,
  render,
}: {
  icon: ReactNode;
  title: string;
  empty: string;
  rows: DueRow[];
  render: (row: DueRow) => ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-semibold [&_svg]:size-4 [&_svg]:text-primary">
        {icon} {title}
        {rows.length > 0 && (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            {rows.length}
          </span>
        )}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="size-4 text-success" /> {empty}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">{rows.map(render)}</ul>
      )}
    </section>
  );
}

function DueLine({
  row: r,
  note,
  tone,
}: {
  row: DueRow;
  note: string;
  tone?: "danger";
}) {
  return (
    <li>
      <Link
        href={`/clients/${r.slug}`}
        className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-elevated"
      >
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-4 ${
            r.billingMode === "stripe"
              ? "bg-primary/12 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {r.billingMode === "stripe" ? <Zap /> : <HandCoins />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{r.name}</p>
          <p
            className={`truncate text-xs ${tone ? "text-destructive" : "text-muted-foreground"}`}
          >
            {note}
          </p>
        </div>
        <span className="text-right text-sm font-semibold tabular-nums">
          {money(r.amount, r.currency)}
          <span className="block text-[11px] font-normal text-muted-foreground">
            /{cycleOf(r.cycle).short}
          </span>
        </span>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}
