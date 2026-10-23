import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  Mail,
  MapPin,
  MessageCircle,
  PencilLine,
  Plus,
  SearchX,
  Store,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  PLANS,
  STAGES,
  STATUSES,
  YEARLY_MONTHS_PAID,
} from "@/lib/clients/options";
import {
  hrefWith,
  todayIn,
  type ClientRow,
  type Facets,
  type ListFilters,
  type ListStats,
} from "@/lib/clients/list";
import { STATE_LABEL, STATE_TONE } from "@/lib/health/state";
import { ClientsToolbar } from "./ClientsToolbar";
import { DemoCard } from "../demo/DemoCard";
import { DeleteClientButton } from "./DeleteClientButton";

const STATUS_STYLE: Record<ClientRow["status"], { dot: string; pill: string }> =
  {
    active: {
      dot: "bg-success",
      pill: "border-success/25 bg-success/10 text-success",
    },
    trial: {
      dot: "bg-accent",
      pill: "border-accent/25 bg-accent/10 text-accent",
    },
    paused: {
      dot: "bg-muted-foreground",
      pill: "border-border-strong bg-muted text-muted-foreground",
    },
    cancelled: {
      dot: "bg-destructive",
      pill: "border-destructive/25 bg-destructive/10 text-destructive",
    },
  };

const label = <T extends { id: string; label?: string; name?: string }>(
  list: readonly T[],
  id: string,
) => {
  const item = list.find((x) => x.id === id);
  return item ? (item.label ?? item.name ?? id) : id;
};

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "LBP" ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function shortDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

const whatsappLink = (phone: string) => {
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  return digits.length >= 7 ? `https://wa.me/${digits}` : null;
};

export function ClientsView({
  rows,
  facets,
  stats,
  filters,
  notice,
  demo,
}: {
  rows: ClientRow[];
  facets: Facets;
  stats: ListStats;
  filters: ListFilters;
  /** After a create, edit or delete: "<name> was added / saved / deleted" */
  notice?: { kind: "created" | "updated" | "deleted"; name: string };
  /** The MESA Demo: pinned above everything, whatever the search, filters or sort */
  demo?: ClientRow | null;
}) {
  const filtered = !!(
    filters.q ||
    filters.status ||
    filters.plan ||
    filters.stage ||
    filters.city
  );
  const today = todayIn();

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Restaurants</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Clients
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            {stats.total === 0
              ? "No clients yet. Add your first restaurant to start tracking its plan and payments."
              : "Everyone on MESA, their plan, and when they pay."}
          </p>
        </div>
        <NewClientButton />
      </div>

      {notice && (
        <p
          role="status"
          className={`mt-6 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${
            notice.kind === "deleted"
              ? "border-border-strong bg-muted text-muted-foreground"
              : "border-success/25 bg-success/10 text-success"
          }`}
        >
          {notice.kind === "deleted" ? (
            <Trash2 className="size-4.5 shrink-0" />
          ) : notice.kind === "updated" ? (
            <PencilLine className="size-4.5 shrink-0" />
          ) : (
            <Store className="size-4.5 shrink-0" />
          )}
          <span>
            <strong className="font-semibold text-foreground">
              {notice.name}
            </strong>{" "}
            was{" "}
            {notice.kind === "created"
              ? "added"
              : notice.kind === "updated"
                ? "saved"
                : "deleted"}
            .
          </span>
        </p>
      )}

      {demo && (
        <DemoCard
          name={demo.name}
          slug={demo.slug}
          domain={demo.domain}
          state={demo.health}
        />
      )}

      {stats.total === 0 ? (
        <EmptyStart />
      ) : (
        <>
          {/* Numbers */}
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              icon={<Users />}
              label="Active clients"
              value={String(stats.active)}
              note={
                stats.trial
                  ? `+ ${stats.trial} on trial`
                  : `${stats.total} in total`
              }
              href={hrefWith(filters, {
                status: filters.status === "active" ? undefined : "active",
              })}
            />
            <Stat
              icon={<CircleDollarSign />}
              label="Monthly income"
              value={
                stats.mrr.length
                  ? money(stats.mrr[0].amount, stats.mrr[0].currency)
                  : money(0, "USD")
              }
              note={
                stats.mrr.length > 1
                  ? stats.mrr
                      .slice(1)
                      .map((m) => `+ ${money(m.amount, m.currency)}`)
                      .join(" ")
                  : `Active clients, yearly ÷ 12`
              }
            />
            <Stat
              icon={<CalendarClock />}
              label="Due this week"
              value={String(stats.dueSoon)}
              note="Next 7 days"
              href={hrefWith(filters, { sort: "billing" })}
            />
            <Stat
              icon={<AlertTriangle />}
              label="Overdue"
              value={String(stats.overdue)}
              note={stats.overdue ? "Date has passed" : "All caught up"}
              tone={stats.overdue ? "danger" : undefined}
              href={hrefWith(filters, { sort: "billing" })}
            />
          </div>

          {/* Search, sort and tags */}
          <div className="mt-8 space-y-4">
            <ClientsToolbar q={filters.q} sort={filters.sort} />
            <div className="space-y-2.5">
              <TagRow label="Status">
                <Tag
                  href={hrefWith(filters, { status: undefined })}
                  active={!filters.status}
                >
                  All
                </Tag>
                {STATUSES.map((s) => (
                  <Tag
                    key={s.id}
                    href={hrefWith(filters, {
                      status: filters.status === s.id ? undefined : s.id,
                    })}
                    active={filters.status === s.id}
                    count={facets.status[s.id] ?? 0}
                    dot={STATUS_STYLE[s.id].dot}
                  >
                    {s.label}
                  </Tag>
                ))}
              </TagRow>
              <TagRow label="Plan">
                <Tag
                  href={hrefWith(filters, { plan: undefined })}
                  active={!filters.plan}
                >
                  All
                </Tag>
                {PLANS.map((p) => (
                  <Tag
                    key={p.id}
                    href={hrefWith(filters, {
                      plan: filters.plan === p.id ? undefined : p.id,
                    })}
                    active={filters.plan === p.id}
                    count={facets.plan[p.id] ?? 0}
                  >
                    {p.name}
                  </Tag>
                ))}
              </TagRow>
              <TagRow label="Website">
                <Tag
                  href={hrefWith(filters, { stage: undefined })}
                  active={!filters.stage}
                >
                  All
                </Tag>
                {STAGES.map((s) => (
                  <Tag
                    key={s.id}
                    href={hrefWith(filters, {
                      stage: filters.stage === s.id ? undefined : s.id,
                    })}
                    active={filters.stage === s.id}
                    count={facets.stage[s.id] ?? 0}
                  >
                    {s.label}
                  </Tag>
                ))}
              </TagRow>
            </div>

            {filtered && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {rows.length} result{rows.length === 1 ? "" : "s"}
                  {filters.q && (
                    <>
                      {" "}
                      for <span className="text-foreground">“{filters.q}”</span>
                    </>
                  )}
                </span>
                {filters.city && (
                  <Link
                    href={hrefWith(filters, { city: undefined })}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium"
                  >
                    <MapPin className="size-3" /> {filters.city}{" "}
                    <X className="size-3" />
                  </Link>
                )}
                <Link
                  href="/clients"
                  className="font-medium text-primary hover:underline"
                >
                  Clear all
                </Link>
              </div>
            )}
          </div>

          {/* The list */}
          {rows.length === 0 ? (
            <NoResults />
          ) : (
            <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
              <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] gap-4 border-b border-border px-5 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:grid">
                <span>Restaurant</span>
                <span>Contact</span>
                <span>Plan</span>
                <span>Next payment</span>
                <span className="w-37 text-right">Actions</span>
              </div>
              <ul className="divide-y divide-border">
                {rows.map((c) => (
                  <Row key={c.id} c={c} filters={filters} today={today} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ───────────── one client ───────────── */

function Row({
  c,
  filters,
  today,
}: {
  c: ClientRow;
  filters: ListFilters;
  today: string;
}) {
  const style = STATUS_STYLE[c.status];
  const billed =
    c.cycle === "yearly" ? c.monthly * YEARLY_MONTHS_PAID : c.monthly;
  const overdue =
    c.status === "active" && !!c.nextBillingDate && c.nextBillingDate < today;
  const dueSoon =
    !overdue &&
    !!c.nextBillingDate &&
    c.nextBillingDate <= todayIn(undefined, 7);
  const billing = c.status === "active" || c.status === "trial";
  const wa = whatsappLink(c.whatsapp);
  const initials = c.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <li className="grid gap-3 px-5 py-4 transition-colors hover:bg-elevated/50 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] md:items-center md:gap-4">
      {/* Restaurant */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border-strong bg-elevated text-sm font-semibold text-primary">
          {initials || "?"}
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={`/clients/${c.slug}`}
              className="truncate font-semibold transition-colors hover:text-primary"
            >
              {c.name}
            </Link>
            {c.health !== "off" && (
              <span
                title={`Health: ${STATE_LABEL[c.health]}`}
                aria-label={`Health: ${STATE_LABEL[c.health]}`}
                className={`size-2 shrink-0 rounded-full ${STATE_TONE[c.health].dot} ${c.health === "down" ? "animate-pulse" : ""}`}
              />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Link
              href={hrefWith(filters, {
                status: filters.status === c.status ? undefined : c.status,
              })}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-opacity hover:opacity-80 ${style.pill}`}
              title={`Show ${label(STATUSES, c.status).toLowerCase()} clients`}
            >
              <span className={`size-1.5 rounded-full ${style.dot}`} />
              {label(STATUSES, c.status)}
            </Link>
            <Link
              href={hrefWith(filters, {
                city:
                  filters.city?.toLowerCase() === c.city.toLowerCase()
                    ? undefined
                    : c.city,
              })}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
              title={`Show clients in ${c.city}`}
            >
              <MapPin className="size-3" />
              {c.city}
            </Link>
            <Link
              href={hrefWith(filters, {
                stage: filters.stage === c.stage ? undefined : c.stage,
              })}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
              title="Show clients at this website stage"
            >
              {label(STAGES, c.stage)}
            </Link>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="min-w-0 text-sm max-md:pl-13">
        <p className="truncate">{c.contactName}</p>
        <p className="truncate text-muted-foreground">{c.domain || c.email}</p>
      </div>

      {/* Plan and price */}
      <div className="flex items-center gap-2 text-sm max-md:pl-13 md:block">
        <Link
          href={hrefWith(filters, {
            plan: filters.plan === c.plan ? undefined : c.plan,
          })}
          className="inline-flex rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          title={`Show ${label(PLANS, c.plan)} clients`}
        >
          {label(PLANS, c.plan)}
        </Link>
        <p className="tabular-nums md:mt-1">
          {money(billed, c.currency)}
          <span className="text-muted-foreground">
            /{c.cycle === "yearly" ? "yr" : "mo"}
          </span>
        </p>
      </div>

      {/* Next payment */}
      <div className="text-sm max-md:pl-13">
        {billing && c.nextBillingDate ? (
          <p
            className={`inline-flex items-center gap-1.5 font-medium ${
              overdue ? "text-destructive" : dueSoon ? "text-accent" : ""
            }`}
          >
            {overdue && <AlertTriangle className="size-3.5" />}
            {shortDate(c.nextBillingDate)}
            <span className="font-normal text-muted-foreground">
              {overdue
                ? "· overdue"
                : dueSoon
                  ? "· this week"
                  : c.status === "trial"
                    ? "· after trial"
                    : ""}
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground">Not billed</p>
        )}
      </div>

      {/* Reach, edit, delete */}
      <div className="flex gap-1.5 max-md:pl-13 md:w-37 md:justify-end">
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            aria-label={`WhatsApp ${c.contactName}`}
            title="WhatsApp"
            className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-success/40 hover:text-success"
          >
            <MessageCircle className="size-4" />
          </a>
        )}
        <a
          href={`mailto:${c.email}`}
          aria-label={`Email ${c.contactName}`}
          title="Email"
          className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          <Mail className="size-4" />
        </a>
        <span
          aria-hidden="true"
          className="mx-0.5 w-px self-stretch bg-border"
        />
        <Link
          href={`/clients/edit/${c.slug}`}
          aria-label={`Edit ${c.name}`}
          title="Edit"
          className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
        >
          <PencilLine className="size-4" />
        </Link>
        <DeleteClientButton name={c.name} slug={c.slug} />
      </div>
    </li>
  );
}

/* ───────────── pieces ───────────── */

function Stat({
  icon,
  label,
  value,
  note,
  href,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  href?: string;
  tone?: "danger";
}) {
  const body = (
    <>
      <span
        className={`grid size-9 place-items-center rounded-xl [&_svg]:size-4.5 ${
          tone === "danger"
            ? "bg-destructive/12 text-destructive"
            : "bg-primary/12 text-primary"
        }`}
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
    </>
  );
  const box = "block rounded-2xl border border-border bg-card p-4 sm:p-5";
  return href ? (
    <Link
      href={href}
      className={`${box} transition-colors hover:border-border-strong hover:bg-elevated`}
    >
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

function TagRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground max-sm:hidden">
        {label}
      </span>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
        {children}
      </div>
    </div>
  );
}

function Tag({
  href,
  active,
  count,
  dot,
  children,
}: {
  href: string;
  active: boolean;
  count?: number;
  dot?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary/15 text-foreground"
          : count === 0
            ? "border-border text-muted-foreground/50 hover:border-border-strong"
            : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
      }`}
    >
      {dot && <span className={`size-1.5 rounded-full ${dot}`} />}
      {children}
      {count !== undefined && (
        <span
          className={`text-xs tabular-nums ${active ? "text-primary" : "text-muted-foreground/70"}`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function NewClientButton() {
  return (
    <Link
      href="/clients/create"
      className="group inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4.5 font-semibold text-primary-foreground shadow-[0_14px_30px_-14px_var(--primary)] transition-all hover:brightness-110 active:translate-y-px"
    >
      <Plus className="size-4.5 transition-transform group-hover:rotate-90" />{" "}
      New client
    </Link>
  );
}

function EmptyStart() {
  return (
    <section className="relative mt-8 overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center sm:px-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 size-120 -translate-x-1/2 rounded-full bg-primary/20 blur-[110px]"
      />
      <div className="relative mx-auto max-w-md">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-border-strong bg-elevated text-primary shadow-[0_20px_50px_-20px_var(--primary)]">
          <Store className="size-6" />
        </span>
        <h2 className="mt-6 text-xl font-semibold tracking-tight">
          Add your first restaurant
        </h2>
        <p className="mt-2 text-pretty text-muted-foreground">
          Save its contact, plan, price and billing day. HQ then knows who pays
          what, and when.
        </p>
        <div className="mt-7 flex justify-center">
          <NewClientButton />
        </div>
      </div>
    </section>
  );
}

function NoResults() {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-border-strong px-6 py-14 text-center">
      <SearchX className="mx-auto size-7 text-muted-foreground" />
      <p className="mt-3 font-semibold">No clients match</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Try another search, or clear the filters.
      </p>
      <Link
        href="/clients"
        className="mt-5 inline-flex h-9 items-center rounded-lg border border-border px-3.5 text-sm font-medium hover:bg-muted"
      >
        Clear filters
      </Link>
    </div>
  );
}
