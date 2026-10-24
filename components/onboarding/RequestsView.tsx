import Link from "next/link";
import {
  Bike,
  CalendarCheck,
  ChevronRight,
  Inbox,
  MessageCircle,
  Search,
  ShoppingBag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { ago } from "@/lib/health/state";
import {
  PLAN_WANTED,
  RESTAURANT_TYPE,
  STATUS_TONE,
} from "@/lib/onboarding/labels";
import {
  REQUEST_FILTERS,
  type RequestFilter,
  type RequestRow,
} from "@/lib/onboarding/queries";
import { REQUEST_STATUSES } from "@/lib/onboarding/schema";
import { ImportDialog } from "./ImportDialog";

export function RequestsView({
  rows,
  counts,
  filter,
  q,
  now,
  deleted,
}: {
  rows: RequestRow[];
  counts: Record<RequestFilter, number>;
  filter: RequestFilter;
  q: string;
  now: number;
  deleted?: string;
}) {
  const href = (f: RequestFilter, query = q) => {
    const params = new URLSearchParams();
    if (f !== "open") params.set("status", f);
    if (query) params.set("q", query);
    const s = params.toString();
    return s ? `/onboarding?${s}` : "/onboarding";
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Requests</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Onboarding
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            Restaurants that filled the form on mesa-template.store.
          </p>
        </div>
        <ImportDialog />
      </div>

      {deleted && (
        <p
          role="status"
          className="mt-6 flex items-center gap-2.5 rounded-xl border border-border-strong bg-muted px-4 py-3 text-sm text-muted-foreground"
        >
          <Trash2 className="size-4.5 shrink-0" />
          <span>
            <strong className="font-semibold text-foreground">{deleted}</strong>{" "}
            was deleted.
          </span>
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav
          aria-label="Filter by status"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 scrollbar-none lg:mx-0 lg:px-0"
        >
          {REQUEST_FILTERS.map((f) => {
            const active = f.id === filter;
            const n = counts[f.id];
            return (
              <Link
                key={f.id}
                href={href(f.id)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                }`}
              >
                {f.label}
                <span
                  className={`min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : f.id === "new" && n
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {n}
                </span>
              </Link>
            );
          })}
        </nav>

        <form action="/onboarding" className="relative lg:w-72">
          {filter !== "open" && (
            <input type="hidden" name="status" value={filter} />
          )}
          <Search className="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-4 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, city, person…"
            aria-label="Search requests"
            className="h-10 w-full rounded-xl border border-border bg-card pr-9 pl-10 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <Link
              href={href(filter, "")}
              aria-label="Clear the search"
              className="absolute inset-y-0 right-1.5 my-auto grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </Link>
          )}
        </form>
      </div>

      {/* The list */}
      {rows.length === 0 ? (
        <Empty filter={filter} q={q} hasAny={counts.all > 0} />
      ) : (
        <ul className="mt-5 space-y-2.5">
          {rows.map((r) => (
            <li key={r.id}>
              <RequestCard r={r} now={now} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ───────────── one request ───────────── */

function RequestCard({ r, now }: { r: RequestRow; now: number }) {
  const tone = STATUS_TONE[r.status];
  const status = REQUEST_STATUSES.find((s) => s.id === r.status)!;
  const services = [
    r.services.delivery && { icon: <Bike />, label: "Delivery" },
    r.services.pickup && { icon: <ShoppingBag />, label: "Pickup" },
    r.services.reservations && {
      icon: <CalendarCheck />,
      label: "Reservations",
    },
    r.services.whatsapp && {
      icon: <MessageCircle />,
      label: "WhatsApp orders",
    },
  ].filter((s): s is { icon: React.ReactElement; label: string } => !!s);

  return (
    <Link
      href={`/onboarding/${r.id}`}
      className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-card p-4 transition-colors hover:border-border-strong hover:bg-elevated/60 sm:p-5 ${
        r.unread ? "border-primary/35" : "border-border"
      }`}
    >
      {r.unread && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1 bg-primary"
        />
      )}

      {/* Logo, or the first letter on their brand colour */}
      <span
        className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border-strong text-lg font-bold sm:size-14"
        style={{
          background: r.logo ? "var(--elevated)" : r.color,
          color: r.logo ? undefined : readableOn(r.color),
        }}
      >
        {r.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- S3 link, any size
          <img src={r.logo} alt="" className="size-full object-contain p-1.5" />
        ) : (
          r.name.trim()[0]?.toUpperCase()
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p
            className={`truncate ${r.unread ? "font-semibold" : "font-medium"}`}
          >
            {r.name}
          </p>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone.pill}`}
          >
            <span className={`size-1.5 rounded-full ${tone.dot}`} />
            {status.label}
          </span>
          {r.unread && (
            <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground uppercase">
              Unread
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {[
            RESTAURANT_TYPE[r.type]?.label,
            r.cuisine.slice(0, 3).join(", "),
            [r.city, r.country].filter(Boolean).join(", "),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="size-3.5" /> {r.person}
          </span>
          <span className="rounded-full bg-primary/12 px-2 py-0.5 font-semibold text-primary">
            {PLAN_WANTED[r.plan]}
          </span>
          {services.length > 0 && (
            <span className="inline-flex items-center gap-1.5 [&_svg]:size-3.5">
              {services.map((s) => (
                <span key={s.label} title={s.label} aria-label={s.label}>
                  {s.icon}
                </span>
              ))}
            </span>
          )}
          {r.clientSlug && (
            <span className="text-success">Client: {r.clientSlug}</span>
          )}
        </div>
      </div>

      <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
        <p>{ago(r.submittedAt, now)}</p>
        <p className="mt-0.5">
          {new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "short",
            timeZone: "Asia/Beirut",
          }).format(new Date(r.submittedAt))}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function readableOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return "#fff";
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#111" : "#fff";
}

function Empty({
  filter,
  q,
  hasAny,
}: {
  filter: RequestFilter;
  q: string;
  hasAny: boolean;
}) {
  return (
    <div className="mt-5 rounded-3xl border border-dashed border-border-strong px-6 py-14 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary">
        <Inbox className="size-5.5" />
      </span>
      {hasAny ? (
        <>
          <p className="mt-4 font-semibold">
            {q ? `Nothing matches “${q}”` : "Nothing here"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter === "open"
              ? "No request is waiting. Everything has been handled."
              : "Try another tab or search."}
          </p>
          <Link
            href="/onboarding?status=all"
            className="mt-5 inline-flex h-9 items-center rounded-lg border border-border px-3.5 text-sm font-medium hover:bg-muted"
          >
            Show all requests
          </Link>
        </>
      ) : (
        <>
          <p className="mt-4 font-semibold">No requests yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-pretty text-muted-foreground">
            When a restaurant fills the onboarding form on mesa-template.store,
            it appears here. Until the MESA API can reach HQ, use “Import from
            email” with the files from the onboarding email.
          </p>
        </>
      )}
    </div>
  );
}
