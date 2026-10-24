import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bike,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  ImageIcon,
  Mail,
  MapPin,
  MessageCircle,
  Palette,
  Phone,
  ShoppingBag,
  Sparkles,
  Store,
  Terminal,
  UserRound,
  UserPlus,
} from "lucide-react";
import { CopyButton } from "@/components/clients/CopyButton";
import { NotesCard } from "@/components/clients/NotesCard";
import { telUrl, whatsappUrl } from "@/lib/clients/detail";
import { ago } from "@/lib/health/state";
import { saveRequestNotes } from "@/lib/onboarding/actions";
import {
  DAY_LABEL,
  PAYMENT_LABEL,
  PLAN_WANTED,
  RESTAURANT_TYPE,
  STATUS_TONE,
  addressOf,
} from "@/lib/onboarding/labels";
import type { RequestDetail } from "@/lib/onboarding/queries";
import { DAYS, REQUEST_STATUSES } from "@/lib/onboarding/schema";
import { RequestActions } from "./RequestActions";

export function RequestDetailView({
  r,
  notice,
}: {
  r: RequestDetail;
  notice?: "imported" | "updated";
}) {
  const a = r.answers;
  const tone = STATUS_TONE[r.status];
  const status = REQUEST_STATUSES.find((s) => s.id === r.status)!;
  const logo = r.files.find((f) => f.kind === "logo");
  const photos = r.files.filter((f) => f.kind === "photo");
  const menus = r.files.filter((f) => f.kind === "menu");
  const personWhatsapp = whatsappUrl(a.person.phone);
  const configName = `${r.ref}-config.json`;
  const hasConfig = r.config.trim() !== "{}" && r.config.trim() !== "";
  const submitted = new Date(r.submittedAt);

  return (
    <>
      <Link
        href="/onboarding"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Onboarding
      </Link>

      {notice && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2.5 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success"
        >
          <CheckCircle2 className="size-4.5 shrink-0" />
          {notice === "imported"
            ? "Imported from the email files."
            : "This request was already here: its answers were updated."}
        </p>
      )}

      <header className="relative mt-4 overflow-hidden rounded-3xl border border-border bg-card">
        <div
          aria-hidden="true"
          className="h-20 sm:h-24"
          style={{
            background: `linear-gradient(120deg, ${a.brand.primaryColor}, color-mix(in srgb, ${a.brand.primaryColor} 35%, var(--card)))`,
          }}
        />
        <div className="relative px-5 pb-5 sm:px-7 sm:pb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-end gap-4">
              {/* the logo overlaps the brand-colour band; the name stays below it */}
              <span className="-mt-10 grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-elevated text-2xl font-bold shadow-lg sm:-mt-12 sm:size-24">
                {logo?.url?.startsWith("http") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- S3 link
                  <img
                    src={logo.url}
                    alt={`${a.restaurant.name} logo`}
                    className="size-full object-contain p-2"
                  />
                ) : (
                  a.restaurant.name.trim()[0]?.toUpperCase()
                )}
              </span>
              <div className="min-w-0 pb-1">
                <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                  {a.restaurant.name}
                </h1>
                {a.restaurant.tagline && (
                  <p className="truncate text-sm text-muted-foreground">
                    {a.restaurant.tagline}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {r.clientSlug ? (
                <Link
                  href={`/clients/${r.clientSlug}`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-success/15 px-4 text-sm font-semibold text-success transition-colors hover:bg-success/25"
                >
                  <Store className="size-4" /> Open client
                </Link>
              ) : (
                <Link
                  href={`/clients/create?from=${r.id}`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_14px_30px_-14px_var(--primary)] transition-all hover:brightness-110 active:translate-y-px"
                >
                  <UserPlus className="size-4" /> Convert to client
                </Link>
              )}
              <RequestActions id={r.id} status={r.status} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone.pill}`}
            >
              <span className={`size-1.5 rounded-full ${tone.dot}`} />
              {status.label}
            </span>
            <Chip>{RESTAURANT_TYPE[a.restaurant.type].label}</Chip>
            <Chip>{a.restaurant.priceRange}</Chip>
            <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {a.extras.plan === "unsure"
                ? "Plan not chosen"
                : `Wants ${PLAN_WANTED[a.extras.plan]}`}
            </span>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5" />
              Received{" "}
              {new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Beirut",
              }).format(submitted)}{" "}
              ({ago(r.submittedAt, r.now)})
            </span>
            <span>
              {r.source === "import"
                ? "Imported from email"
                : "From the website"}
            </span>
            <span className="inline-flex items-center gap-0.5 font-mono">
              {r.ref}
              <CopyButton value={r.ref} label="Copy the reference" />
            </span>
          </p>
        </div>
      </header>

      {/* ───── Details ───── */}
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className="min-w-0 space-y-6">
          <Card icon={<Store />} title="The restaurant">
            <p className="text-sm leading-relaxed text-pretty whitespace-pre-line">
              {a.restaurant.description}
            </p>
            <dl className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-4 sm:grid-cols-2">
              <Item label="Cuisine">
                <span className="flex flex-wrap gap-1.5">
                  {a.restaurant.cuisine.map((c) => (
                    <Chip key={c}>{c}</Chip>
                  ))}
                </span>
              </Item>
              <Item label="Price range">{a.restaurant.priceRange}</Item>
              {a.restaurant.since && (
                <Item label="Open since">{a.restaurant.since}</Item>
              )}
              {a.contact.legalName && (
                <Item label="Legal name">{a.contact.legalName}</Item>
              )}
            </dl>
          </Card>

          <Card icon={<MapPin />} title="Location & contact">
            <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-4 sm:grid-cols-2">
              <Item label="Address">
                {addressOf(a.contact) && (
                  <span className="block">{addressOf(a.contact)}</span>
                )}
                <span
                  className={
                    addressOf(a.contact) ? "text-muted-foreground" : ""
                  }
                >
                  {a.contact.city}, {a.contact.country}
                </span>
              </Item>
              <Item label="On the map">
                {a.contact.mapsLink ? (
                  <ExternalLink href={a.contact.mapsLink}>
                    Google Maps
                  </ExternalLink>
                ) : a.contact.location ? (
                  <ExternalLink
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.contact.location)}`}
                  >
                    {a.contact.location}
                  </ExternalLink>
                ) : (
                  <span className="text-muted-foreground">Not given</span>
                )}
              </Item>
              <Item label="Restaurant phone">
                <CopyLine
                  value={a.contact.phone}
                  href={telUrl(a.contact.phone)}
                />
              </Item>
              <Item label="WhatsApp">
                {a.contact.whatsapp ? (
                  <CopyLine
                    value={a.contact.whatsapp}
                    href={whatsappUrl(a.contact.whatsapp)}
                    external
                  />
                ) : (
                  <span className="text-muted-foreground">Same as phone</span>
                )}
              </Item>
              <Item label="Email">
                <CopyLine
                  value={a.contact.email}
                  href={`mailto:${a.contact.email}`}
                />
              </Item>
              <Item label="Social">
                {a.contact.instagram ||
                a.contact.facebook ||
                a.contact.tiktok ? (
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {a.contact.instagram && (
                      <ExternalLink href={a.contact.instagram}>
                        Instagram
                      </ExternalLink>
                    )}
                    {a.contact.facebook && (
                      <ExternalLink href={a.contact.facebook}>
                        Facebook
                      </ExternalLink>
                    )}
                    {a.contact.tiktok && (
                      <ExternalLink href={a.contact.tiktok}>
                        TikTok
                      </ExternalLink>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </Item>
            </dl>
          </Card>

          <Card icon={<Clock3 />} title="Opening hours">
            <ul className="divide-y divide-border rounded-xl border border-border">
              {DAYS.map((d) => {
                const day = a.hours[d];
                return (
                  <li
                    key={d}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
                  >
                    <span className="font-medium">{DAY_LABEL[d]}</span>
                    {day.closed || day.shifts.length === 0 ? (
                      <span className="text-muted-foreground">Closed</span>
                    ) : (
                      <span className="text-right tabular-nums">
                        {day.shifts
                          .map((s) => `${s.open} – ${s.close}`)
                          .join(", ")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card icon={<ShoppingBag />} title="Services & payments">
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-2">
              <Service
                icon={<CalendarCheck />}
                on={a.services.reservations}
                title="Reservations"
                detail={
                  a.services.maxPartySize
                    ? `Up to ${a.services.maxPartySize} people`
                    : undefined
                }
              />
              <Service
                icon={<Bike />}
                on={a.services.delivery}
                title="Delivery"
                detail={
                  a.services.delivery
                    ? [
                        a.services.deliveryFee !== undefined &&
                          `Fee ${money(a.services.deliveryFee, a.services.currency)}`,
                        a.services.deliveryMinimum !== undefined &&
                          `minimum ${money(a.services.deliveryMinimum, a.services.currency)}`,
                        a.services.deliveryFreeOver !== undefined &&
                          `free over ${money(a.services.deliveryFreeOver, a.services.currency)}`,
                      ]
                        .filter(Boolean)
                        .join(", ") || undefined
                    : undefined
                }
              />
              <Service
                icon={<ShoppingBag />}
                on={a.services.pickup}
                title="Pickup"
              />
              <Service
                icon={<MessageCircle />}
                on={a.services.whatsappOrdering}
                title="Orders on WhatsApp"
              />
            </ul>
            {a.services.delivery && a.services.deliveryAreas && (
              <div className="mt-4 rounded-xl border border-border bg-elevated/40 px-4 py-3 text-sm">
                <p className="text-xs text-muted-foreground">Delivery areas</p>
                <p className="mt-1 whitespace-pre-line">
                  {a.services.deliveryAreas}
                </p>
              </div>
            )}
            <dl className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-4 sm:grid-cols-2">
              <Item label="Guests pay with">
                {a.services.payments.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {a.services.payments.map((p) => (
                      <Chip key={p}>{PAYMENT_LABEL[p]}</Chip>
                    ))}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not chosen</span>
                )}
              </Item>
              <Item label="Menu currency">{a.services.currency}</Item>
            </dl>
          </Card>

          <Card icon={<ImageIcon />} title="Photos & files">
            {r.files.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {r.source === "import"
                  ? "Their logo, photos and menus are attached to the onboarding email."
                  : "They didn't send any files."}
              </p>
            ) : (
              <>
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {photos.map((p) =>
                      p.url?.startsWith("http") ? (
                        <a
                          key={p.name}
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative aspect-4/3 overflow-hidden rounded-xl border border-border bg-elevated"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- S3 link */}
                          <img
                            src={p.url}
                            alt={p.name}
                            loading="lazy"
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </a>
                      ) : (
                        <span
                          key={p.name}
                          className="grid aspect-4/3 place-items-center rounded-xl border border-dashed border-border-strong text-xs text-muted-foreground"
                        >
                          {p.name}
                        </span>
                      ),
                    )}
                  </div>
                )}
                {(menus.length > 0 || logo) && (
                  <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
                    {[...(logo ? [logo] : []), ...menus].map((f) => (
                      <li
                        key={f.name}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm"
                      >
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">
                          {f.kind === "logo" ? "Logo" : "Menu"} · {f.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {size(f.bytes)}
                        </span>
                        {f.url?.startsWith("http") && (
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${f.name}`}
                            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <ArrowUpRight className="size-4" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {a.extras.menuLink && (
              <p className="mt-4 text-sm">
                Menu online:{" "}
                <ExternalLink href={a.extras.menuLink}>
                  {shortUrl(a.extras.menuLink)}
                </ExternalLink>
              </p>
            )}
          </Card>
        </div>

        <aside className="min-w-0 space-y-6">
          <Card icon={<UserRound />} title="Who filled it">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold">
                {a.person.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase())
                  .join("")}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{a.person.name}</p>
                {a.person.role && (
                  <p className="truncate text-sm text-muted-foreground">
                    {a.person.role}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <CopyLine
                value={a.person.phone}
                href={telUrl(a.person.phone)}
                icon={<Phone />}
              />
              <CopyLine
                value={a.contact.email}
                href={`mailto:${a.contact.email}`}
                icon={<Mail />}
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Reach
                href={telUrl(a.person.phone)}
                icon={<Phone />}
                label="Call"
              />
              <Reach
                href={personWhatsapp}
                icon={<MessageCircle />}
                label="WhatsApp"
                external
              />
              <Reach
                href={`mailto:${a.contact.email}`}
                icon={<Mail />}
                label="Email"
              />
            </div>
          </Card>

          <Card icon={<Sparkles />} title="Plan & wishes">
            <dl className="space-y-4">
              <Item label="Plan they picked">{PLAN_WANTED[a.extras.plan]}</Item>
              <Item label="Domain">
                {a.extras.domain ? (
                  <span className="font-mono text-[13px]">
                    {a.extras.domain}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not chosen yet</span>
                )}
              </Item>
              {a.extras.notes && (
                <Item label="Their notes">
                  <span className="block font-normal whitespace-pre-line text-pretty">
                    {a.extras.notes}
                  </span>
                </Item>
              )}
            </dl>
          </Card>

          <Card icon={<Palette />} title="Brand">
            <div className="flex items-center gap-4">
              <span
                className="size-14 shrink-0 rounded-2xl border border-border-strong shadow-inner"
                style={{ background: a.brand.primaryColor }}
              />
              <div className="min-w-0">
                <p className="flex items-center gap-1 font-mono text-sm font-medium uppercase">
                  {a.brand.primaryColor}
                  <CopyButton
                    value={a.brand.primaryColor}
                    label="Copy the colour"
                  />
                </p>
                <p className="text-sm text-muted-foreground">
                  {a.brand.mode === "dark" ? "Dark" : "Light"} website
                </p>
              </div>
            </div>
          </Card>

          <Card icon={<Terminal />} title="Set up the site">
            <p className="text-sm text-muted-foreground">
              Download the config, then create the site from it:
            </p>
            <div className="mt-3 flex items-center gap-1 rounded-xl border border-border bg-background/70 px-3 py-2.5 font-mono text-xs">
              <code className="min-w-0 flex-1 truncate">
                npm run new-site -- {configName}
              </code>
              <CopyButton
                value={`npm run new-site -- ${configName}`}
                label="Copy the command"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={`/onboarding/${r.id}/download?file=config`}
                aria-disabled={!hasConfig}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors ${
                  hasConfig
                    ? "border-primary/35 bg-primary/10 text-foreground hover:bg-primary/15"
                    : "pointer-events-none border-border text-muted-foreground/50"
                }`}
              >
                <Download className="size-4" /> config.json
              </a>
              <a
                href={`/onboarding/${r.id}/download?file=answers`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium transition-colors hover:border-border-strong hover:bg-elevated"
              >
                <Download className="size-4" /> answers.json
              </a>
            </div>
            {!hasConfig && (
              <p className="mt-2 text-xs text-muted-foreground">
                No config came with this request: import the config file from
                the email to add it.
              </p>
            )}
          </Card>

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <NotesCard
              notes={r.notes}
              save={saveRequestNotes.bind(null, r.id)}
              hint="Only for your team"
            />
          </section>
        </aside>
      </div>
    </>
  );
}

/* ───────────── pieces ───────────── */

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

const size = (bytes: number) =>
  bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`;

const shortUrl = (url: string) =>
  url
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/$/, "")
    .slice(0, 40);

function Card({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="mb-5 flex items-center gap-2 font-semibold [&_svg]:size-4 [&_svg]:text-primary">
        {icon} {title}
      </h2>
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

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
    >
      <span className="truncate">{children}</span>
      <ArrowUpRight className="size-3.5 shrink-0" />
    </a>
  );
}

function CopyLine({
  value,
  href,
  icon,
  external,
}: {
  value: string;
  href: string | null;
  icon?: ReactNode;
  external?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {icon && (
        <span className="shrink-0 text-muted-foreground [&_svg]:size-4">
          {icon}
        </span>
      )}
      {href ? (
        <a
          href={href}
          {...(external && { target: "_blank", rel: "noreferrer" })}
          className="min-w-0 truncate font-medium transition-colors hover:text-primary"
        >
          {value}
        </a>
      ) : (
        <span className="min-w-0 truncate">{value}</span>
      )}
      <CopyButton value={value} />
    </span>
  );
}

function Reach({
  href,
  icon,
  label,
  external,
}: {
  href: string | null;
  icon: ReactNode;
  label: string;
  external?: boolean;
}) {
  const base =
    "flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium [&_svg]:size-4.5";
  return href ? (
    <a
      href={href}
      {...(external && { target: "_blank", rel: "noreferrer" })}
      className={`${base} border-border text-muted-foreground transition-colors hover:border-border-strong hover:bg-elevated hover:text-foreground`}
    >
      {icon}
      {label}
    </a>
  ) : (
    <span className={`${base} border-border text-muted-foreground/40`}>
      {icon}
      {label}
    </span>
  );
}

function Service({
  icon,
  on,
  title,
  detail,
}: {
  icon: ReactNode;
  on: boolean;
  title: string;
  detail?: string;
}) {
  return (
    <li
      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${
        on ? "border-primary/30 bg-primary/6" : "border-border"
      }`}
    >
      <span
        className={`mt-0.5 [&_svg]:size-4 ${on ? "text-primary" : "text-muted-foreground/50"}`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className={`block text-sm font-medium ${on ? "" : "text-muted-foreground/70 line-through decoration-muted-foreground/40"}`}
        >
          {title}
        </span>
        <span className="block text-xs text-muted-foreground">
          {on ? (detail ?? "Yes") : "Not needed"}
        </span>
      </span>
    </li>
  );
}
