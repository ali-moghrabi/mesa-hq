import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe,
  History,
  Mail,
  MapPin,
  MessageCircle,
  PencilLine,
  Phone,
  Pin,
  ServerCog,
  Sparkles,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { FEATURES, STAGES, YEARLY_MONTHS_PAID } from "@/lib/clients/options";
import {
  billed,
  dateTime,
  dayOf,
  daysBetween,
  durationSince,
  initials,
  longDate,
  mapsUrl,
  methodLabel,
  money,
  planName,
  relativeDays,
  siteUrl,
  stageLabel,
  statusLabel,
  telUrl,
  typeLabel,
  whatsappUrl,
  type ClientDetail,
} from "@/lib/clients/detail";
import { DeleteClientButton } from "./DeleteClientButton";
import { CopyButton } from "./CopyButton";
import { NotesCard } from "./NotesCard";

const STATUS_TONE: Record<
  ClientDetail["status"],
  { dot: string; pill: string }
> = {
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

export function ClientDetailView({
  client: c,
  today,
  saved,
  health,
}: {
  client: ClientDetail;
  today: string;
  saved?: boolean;
  /** The Health card, rendered by the page */
  health?: ReactNode;
}) {
  const billsNow = c.status === "active" || c.status === "trial";
  const dueIn =
    billsNow && c.nextBillingDate
      ? daysBetween(today, c.nextBillingDate)
      : null;
  const overdue = c.status === "active" && dueIn !== null && dueIn < 0;
  const site = siteUrl(c.domain);
  const whatsapp = whatsappUrl(c.contact.whatsapp || c.contact.phone);
  const tone = STATUS_TONE[c.status];

  return (
    <>
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Clients
      </Link>

      {saved && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2.5 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success"
        >
          <CheckCircle2 className="size-4.5 shrink-0" /> Changes saved.
        </p>
      )}

      {/* ───── Header ───── */}
      <header
        className={`relative mt-4 overflow-hidden rounded-3xl border bg-card p-5 sm:p-7 ${
          c.isDemo
            ? "border-primary/35 shadow-[0_30px_80px_-40px_var(--primary)]"
            : "border-border"
        }`}
      >
        {c.isDemo && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_45%,color-mix(in_srgb,var(--highlight)_10%,transparent))]"
          />
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-primary/15 blur-[90px]"
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:items-center sm:gap-5">
            {c.isDemo ? (
              <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(140deg,var(--primary),var(--highlight))] text-xl font-extrabold text-primary-foreground shadow-[0_14px_36px_-12px_var(--primary)] sm:size-16">
                M
                <Sparkles className="absolute -top-1.5 -right-1.5 size-4.5 rounded-full bg-card p-0.5 text-accent" />
              </span>
            ) : (
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-border-strong bg-elevated text-lg font-semibold text-primary shadow-[0_18px_40px_-22px_var(--primary)] sm:size-16 sm:text-xl">
                {initials(c.name)}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                {c.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {c.isDemo && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/12 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <Pin className="size-3 rotate-45" /> MESA Demo · pinned
                  </span>
                )}
                {!c.isDemo && (
                  <Link
                    href={`/clients?status=${c.status}`}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80 ${tone.pill}`}
                  >
                    <span className={`size-1.5 rounded-full ${tone.dot}`} />
                    {statusLabel(c.status)}
                  </Link>
                )}
                {!c.isDemo && (
                  <Link
                    href={`/clients?plan=${c.plan}`}
                    className="rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                  >
                    {planName(c.plan)}
                  </Link>
                )}
                {c.founding && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 px-2.5 py-0.5 text-xs font-medium text-accent">
                    <Sparkles className="size-3" /> Founding
                  </span>
                )}
                <Link
                  href={`/clients?city=${encodeURIComponent(c.city)}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                >
                  <MapPin className="size-3" /> {c.city}
                </Link>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-0.5 font-mono text-xs">
                  sites/{c.slug}
                  <CopyButton value={c.slug} label="Copy the site id" />
                </span>
                {site && (
                  <a
                    href={site}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    <Globe className="size-3.5" /> {c.domain}
                  </a>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {site && (
              <ActionLink href={site} external icon={<ExternalLink />}>
                Visit site
              </ActionLink>
            )}
            {whatsapp && (
              <ActionLink href={whatsapp} external icon={<MessageCircle />}>
                WhatsApp
              </ActionLink>
            )}
            <Link
              href={`/clients/edit/${c.slug}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_14px_30px_-14px_var(--primary)] transition-all hover:brightness-110 active:translate-y-px"
            >
              <PencilLine className="size-4" /> Edit
            </Link>
            {!c.isDemo && (
              <DeleteClientButton
                name={c.name}
                slug={c.slug}
                redirectTo="/clients"
                size="lg"
              />
            )}
          </div>
        </div>
      </header>

      {!c.isDemo && (
        <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon={<Wallet />}
            label={c.cycle === "yearly" ? "Billed yearly" : "Billed monthly"}
            value={
              <>
                {money(billed(c), c.currency)}
                <span className="text-base font-normal text-muted-foreground">
                  /{c.cycle === "yearly" ? "yr" : "mo"}
                </span>
              </>
            }
            note={
              c.cycle === "yearly"
                ? `${money((c.monthlyPrice * YEARLY_MONTHS_PAID) / 12, c.currency)} a month · ${planName(c.plan)}`
                : `${planName(c.plan)} plan`
            }
          />
          <Stat
            icon={overdue ? <AlertTriangle /> : <CalendarClock />}
            tone={
              overdue
                ? "danger"
                : dueIn !== null && dueIn <= 7
                  ? "warn"
                  : undefined
            }
            label="Next payment"
            value={
              billsNow && c.nextBillingDate ? longDate(c.nextBillingDate) : "—"
            }
            note={
              !billsNow
                ? `Not billed while ${statusLabel(c.status).toLowerCase()}`
                : dueIn === null
                  ? "No date set"
                  : overdue
                    ? `Overdue by ${-dueIn} day${dueIn === -1 ? "" : "s"}`
                    : c.status === "trial"
                      ? `After the trial · ${relativeDays(dueIn)}`
                      : relativeDays(dueIn).replace(/^./, (ch) =>
                          ch.toUpperCase(),
                        )
            }
          />
          <Stat
            icon={<CalendarDays />}
            label="Client for"
            value={durationSince(c.startDate, today) || "Not started"}
            note={
              c.startDate
                ? `${c.startDate > today ? "Starts" : "Since"} ${longDate(c.startDate)}`
                : "No start date"
            }
          />
          <Stat
            icon={c.setupPaid ? <CheckCircle2 /> : <Clock3 />}
            tone={c.setupPaid || c.setupFee === 0 ? undefined : "warn"}
            label="Setup fee"
            value={money(c.setupFee, c.currency)}
            note={
              c.setupFee === 0
                ? "No setup fee"
                : c.setupPaid
                  ? "Paid"
                  : "Not paid yet"
            }
          />
        </section>
      )}

      {/* ───── Website progress ───── */}
      <StageTrack stage={c.stage} launchDate={c.launchDate} today={today} />

      {health}

      {/* ───── Details ───── */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className="space-y-6">
          {/* Subscription (not for the demo) */}
          {!c.isDemo && (
            <>
              <Card
                icon={<Wallet />}
                title="Subscription"
                action={
                  <EditLink slug={c.slug} label="Edit the subscription" />
                }
              >
                <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  <Item label="Plan">
                    {planName(c.plan)}
                    {c.founding && (
                      <span className="ml-2 text-xs text-accent">
                        founding client
                      </span>
                    )}
                  </Item>
                  <Item label="Price">
                    {money(c.monthlyPrice, c.currency)}
                    <span className="text-muted-foreground"> / month</span>
                    {c.cycle === "yearly" && (
                      <span className="block text-xs text-muted-foreground">
                        Prepaid yearly: {money(billed(c), c.currency)} for 12
                        months
                      </span>
                    )}
                  </Item>
                  <Item label="Billing">
                    {c.cycle === "yearly"
                      ? "Once a year"
                      : `Monthly, on the ${ordinal(c.billingDay)}`}
                  </Item>
                  <Item label="Usually pays by">
                    {methodLabel(c.paymentMethod)}
                  </Item>
                  <Item label="Start date">{longDate(c.startDate) || "—"}</Item>
                  {c.status === "trial" ? (
                    <Item label="Trial ends">
                      {longDate(c.trialEndsAt) || "—"}
                      {c.trialEndsAt && (
                        <span className="block text-xs text-muted-foreground">
                          {relativeDays(daysBetween(today, c.trialEndsAt))}
                        </span>
                      )}
                    </Item>
                  ) : (
                    <Item label="Status">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`size-1.5 rounded-full ${tone.dot}`} />
                        {statusLabel(c.status)}
                      </span>
                    </Item>
                  )}
                  <Item label="Setup fee">
                    {money(c.setupFee, c.currency)}{" "}
                    {c.setupFee > 0 && (
                      <span
                        className={`text-xs ${c.setupPaid ? "text-success" : "text-accent"}`}
                      >
                        {c.setupPaid ? "paid" : "not paid yet"}
                      </span>
                    )}
                  </Item>
                  <Item label="Currency">{c.currency}</Item>
                </dl>
                <p className="mt-6 flex items-start gap-2 rounded-xl border border-dashed border-border-strong px-3.5 py-3 text-xs text-muted-foreground">
                  <History className="mt-px size-3.5 shrink-0" />
                  Payment history will show here once payments can be recorded
                  in HQ.
                </p>
              </Card>
            </>
          )}

          {/* Website */}
          <Card
            icon={<Globe />}
            title="Website"
            action={<EditLink slug={c.slug} label="Edit the website details" />}
          >
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <Item label="Domain">
                {site ? (
                  <a
                    href={site}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[13px] transition-colors hover:text-primary"
                  >
                    {c.domain} <ArrowUpRight className="size-3.5" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">Not set yet</span>
                )}
              </Item>
              <Item label="Stage">
                {stageLabel(c.stage)}
                {c.launchDate && (
                  <span className="block text-xs text-muted-foreground">
                    {c.launchDate > today ? "Launch planned" : "Launched"}{" "}
                    {longDate(c.launchDate)}
                  </span>
                )}
              </Item>
            </dl>

            {site && (
              <div className="mt-5 flex flex-wrap gap-2">
                <QuickLink href={site}>Website</QuickLink>
                <QuickLink href={`${site}/admin`}>Admin panel</QuickLink>
                <QuickLink href={`${site}/admin/orders`}>Orders</QuickLink>
              </div>
            )}

            <h3 className="mt-7 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Included features
            </h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {FEATURES.map((f) => {
                const on = c.features[f.id];
                return (
                  <li
                    key={f.id}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm ${
                      on
                        ? "border-primary/30 bg-primary/6"
                        : "border-border text-muted-foreground/70"
                    }`}
                  >
                    <span
                      className={`grid size-4.5 shrink-0 place-items-center rounded-md ${
                        on
                          ? "bg-primary text-primary-foreground"
                          : "border border-border-strong"
                      }`}
                    >
                      {on ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : (
                        <X className="size-2.5" />
                      )}
                    </span>
                    {f.label}
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Notes */}
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <NotesCard slug={c.slug} notes={c.notes} />
          </section>
        </div>

        <aside className="space-y-6">
          {/* Contact */}
          <Card icon={<UserRound />} title="Contact">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold">
                {initials(c.contact.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{c.contact.name || "—"}</p>
                {c.contact.role && (
                  <p className="truncate text-sm text-muted-foreground">
                    {c.contact.role}
                  </p>
                )}
              </div>
            </div>
            <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
              <ContactRow
                icon={<Phone />}
                label="Phone"
                value={c.contact.phone}
                href={telUrl(c.contact.phone)}
              />
              {c.contact.whatsapp && c.contact.whatsapp !== c.contact.phone && (
                <ContactRow
                  icon={<MessageCircle />}
                  label="WhatsApp"
                  value={c.contact.whatsapp}
                  href={whatsappUrl(c.contact.whatsapp)}
                  external
                />
              )}
              <ContactRow
                icon={<Mail />}
                label="Email"
                value={c.contact.email}
                href={c.contact.email ? `mailto:${c.contact.email}` : null}
              />
            </ul>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <ReachButton
                href={telUrl(c.contact.phone)}
                icon={<Phone />}
                label="Call"
              />
              <ReachButton
                href={whatsapp}
                icon={<MessageCircle />}
                label="WhatsApp"
                external
                tone="success"
              />
              <ReachButton
                href={c.contact.email ? `mailto:${c.contact.email}` : null}
                icon={<Mail />}
                label="Email"
              />
            </div>
          </Card>

          {/* Restaurant */}
          <Card icon={<Building2 />} title="Restaurant">
            <dl className="space-y-4">
              <Item label="Type">{typeLabel(c.type)}</Item>
              <Item label="Address">
                {c.address && <span className="block">{c.address}</span>}
                <span className={c.address ? "text-muted-foreground" : ""}>
                  {[c.city, c.country].filter(Boolean).join(", ")}
                </span>
              </Item>
            </dl>
            <a
              href={mapsUrl(c)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <MapPin className="size-4" /> Open in Google Maps
            </a>
          </Card>

          {/* Setup (technical) */}
          <Card icon={<ServerCog />} title="Setup">
            <ul className="space-y-1">
              <TechRow label="Site id" value={c.slug} />
              <TechRow label="MESA_SITE" value={c.slug} />
              <TechRow label="Database" value={`mesa_${c.slug}`} />
              <TechRow label="Files (S3)" value={`${c.slug}/`} />
              {c.vercelProject && (
                <TechRow label="Vercel" value={c.vercelProject} />
              )}
              {c.apiUrl && <TechRow label="API" value={c.apiUrl} />}
              {c.renderService && (
                <TechRow label="Render" value={c.renderService} />
              )}
            </ul>
          </Card>

          {/* Timeline */}
          <Card icon={<History />} title="Timeline">
            <Timeline client={c} today={today} billsNow={billsNow} />
          </Card>
        </aside>
      </div>
    </>
  );
}

/* ───────────── website stages ───────────── */

function StageTrack({
  stage,
  launchDate,
  today,
}: {
  stage: ClientDetail["stage"];
  launchDate: string;
  today: string;
}) {
  const current = STAGES.findIndex((s) => s.id === stage);
  const live = stage === "live";

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card px-5 py-5 sm:px-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Globe className="size-4 text-primary" /> Website progress
        </h2>
        <p className="text-sm text-muted-foreground">
          {live
            ? launchDate
              ? `Live since ${longDate(launchDate)}`
              : "Live"
            : launchDate
              ? `${launchDate < today ? "Launch was planned for" : "Launch planned"} ${longDate(launchDate)}`
              : `Step ${current + 1} of ${STAGES.length}`}
        </p>
      </div>
      <ol className="mt-5 grid grid-cols-4">
        {STAGES.map((s, i) => {
          const done = i < current || (live && i === current);
          const active = i === current && !live;
          return (
            <li
              key={s.id}
              className="relative flex flex-col items-center text-center"
            >
              {/* the line to the next step */}
              {i < STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-3.5 left-1/2 h-0.5 w-full ${
                    i < current ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
              <span
                className={`relative z-10 grid size-7 place-items-center rounded-full border-2 text-xs font-semibold transition-colors ${
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                      ? "border-primary bg-card text-primary shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_20%,transparent)]"
                      : "border-border-strong bg-card text-muted-foreground"
                }`}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`mt-2 text-xs font-medium sm:text-sm ${
                  done || active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ───────────── timeline ───────────── */

type Event = { date: string; title: string; detail?: string; at?: string };

function Timeline({
  client: c,
  today,
  billsNow,
}: {
  client: ClientDetail;
  today: string;
  billsNow: boolean;
}) {
  const events: Event[] = [];
  if (billsNow && c.nextBillingDate && !c.isDemo)
    events.push({
      date: c.nextBillingDate,
      title: c.nextBillingDate < today ? "Payment was due" : "Next payment due",
      detail: money(billed(c), c.currency),
    });
  if (c.status === "trial" && c.trialEndsAt)
    events.push({
      date: c.trialEndsAt,
      title: c.trialEndsAt < today ? "Trial ended" : "Trial ends",
    });
  if (c.launchDate)
    events.push({
      date: c.launchDate,
      title:
        c.launchDate > today
          ? "Launch planned"
          : c.stage === "live"
            ? "Website launched"
            : "Launch was planned",
    });
  if (c.startDate && !c.isDemo)
    events.push({
      date: c.startDate,
      title:
        c.startDate > today ? "Subscription starts" : "Subscription started",
      detail: `${planName(c.plan)} plan`,
    });
  if (c.createdAt)
    events.push({
      date: dayOf(c.createdAt),
      title: "Added to HQ",
      detail: c.createdBy ? `by ${c.createdBy}` : undefined,
      at: dateTime(c.createdAt),
    });
  if (
    c.updatedAt &&
    c.createdAt &&
    new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 60_000
  )
    events.push({
      date: dayOf(c.updatedAt),
      title: "Last edited",
      at: dateTime(c.updatedAt),
    });

  // Newest (or upcoming) first; on the same day, keep the order above
  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  if (!events.length)
    return <p className="text-sm text-muted-foreground">No dates yet.</p>;

  return (
    <ol className="relative">
      {events.map((e, i) => {
        const upcoming = e.date > today;
        return (
          <li
            key={`${e.title}-${i}`}
            className="relative flex gap-3.5 pb-5 last:pb-0"
          >
            {i < events.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-4 bottom-0 left-1.25 w-px bg-border"
              />
            )}
            <span
              className={`relative mt-1.5 size-2.75 shrink-0 rounded-full border-2 ${
                upcoming
                  ? "border-primary bg-card"
                  : "border-border-strong bg-border-strong"
              }`}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {e.title}
                {upcoming && (
                  <span className="ml-2 rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
                    Upcoming
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {e.at ?? longDate(e.date)}
                {e.detail && <> · {e.detail}</>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

function Card({
  icon,
  title,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold [&_svg]:size-4 [&_svg]:text-primary">
          {icon} {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium wrap-break-word">{children}</dd>
    </div>
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
  value: ReactNode;
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
      <div className="flex items-center gap-2.5">
        <span
          className={`grid size-8 place-items-center rounded-lg [&_svg]:size-4 ${color}`}
        >
          {icon}
        </span>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p
        className={`mt-3 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl ${
          tone === "danger" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
      <p
        className={`mt-0.5 truncate text-xs ${
          tone === "danger"
            ? "text-destructive/80"
            : tone === "warn"
              ? "text-accent"
              : "text-muted-foreground"
        }`}
      >
        {note}
      </p>
    </div>
  );
}

function ActionLink({
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
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-elevated/60 px-3.5 text-sm font-medium transition-colors hover:border-border-strong hover:bg-elevated [&_svg]:size-4 [&_svg]:text-muted-foreground"
    >
      {icon}
      {children}
    </a>
  );
}

function EditLink({ slug, label }: { slug: string; label: string }) {
  return (
    <Link
      href={`/clients/edit/${slug}`}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <PencilLine className="size-4" />
    </Link>
  );
}

function QuickLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
    >
      {children} <ArrowUpRight className="size-3.5" />
    </a>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
  external,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href: string | null;
  external?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {value && href ? (
          <a
            href={href}
            {...(external && { target: "_blank", rel: "noreferrer" })}
            className="block truncate text-sm font-medium transition-colors hover:text-primary"
          >
            {value}
          </a>
        ) : (
          <p className="truncate text-sm font-medium">{value || "—"}</p>
        )}
      </div>
      {value && (
        <CopyButton value={value} label={`Copy the ${label.toLowerCase()}`} />
      )}
    </li>
  );
}

function ReachButton({
  href,
  icon,
  label,
  external,
  tone,
}: {
  href: string | null;
  icon: ReactNode;
  label: string;
  external?: boolean;
  tone?: "success";
}) {
  const base =
    "flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium [&_svg]:size-4.5";
  if (!href)
    return (
      <span
        aria-disabled="true"
        className={`${base} border-border text-muted-foreground/40`}
      >
        {icon}
        {label}
      </span>
    );
  return (
    <a
      href={href}
      {...(external && { target: "_blank", rel: "noreferrer" })}
      className={`${base} border-border text-muted-foreground transition-colors ${
        tone === "success"
          ? "hover:border-success/40 hover:bg-success/8 hover:text-success"
          : "hover:border-border-strong hover:bg-elevated hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </a>
  );
}

function TechRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-1 py-1">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      <code className="min-w-0 flex-1 truncate font-mono text-[13px]">
        {value}
      </code>
      <CopyButton value={value} label={`Copy ${label}`} />
    </li>
  );
}
