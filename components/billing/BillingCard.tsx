import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  ExternalLink,
  FileText,
  HandCoins,
  PauseCircle,
  Receipt,
  Repeat,
  Zap,
} from "lucide-react";
import { cycleOf } from "@/lib/clients/options";
import {
  billed,
  daysBetween,
  longDate,
  methodLabel,
  money,
  relativeDays,
  type ClientDetail,
} from "@/lib/clients/detail";
import type { PaymentRow } from "@/lib/billing/queries";
import {
  BillingActions,
  DeletePaymentButton,
  SendLink,
  SetupPaidSwitch,
  type BillingClient,
} from "./BillingActions";

const BRAND: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  unionpay: "UnionPay",
  jcb: "JCB",
  diners: "Diners",
};

const NO_STRIPE: ClientDetail["stripe"] = {
  customerId: "",
  subscriptionId: "",
  status: "",
  currentPeriodEnd: "",
  cancelAtPeriodEnd: false,
  paused: false,
  resumesAt: "",
  card: { brand: "", last4: "", expMonth: 0, expYear: 0 },
  checkoutUrl: "",
  checkoutExpiresAt: "",
  lastPaymentError: "",
  syncedAt: "",
};

export function BillingCard({
  client,
  payments,
  totals,
  today,
  stripeReady,
}: {
  client: ClientDetail;
  payments: PaymentRow[];
  totals: { currency: string; amount: number }[];
  today: string;
  stripeReady: boolean;
}) {
  const c: ClientDetail = {
    ...client,
    billingMode: client.billingMode ?? "manual",
    stripe: {
      ...NO_STRIPE,
      ...client.stripe,
      card: { ...NO_STRIPE.card, ...client.stripe?.card },
    },
  };
  const automatic = c.billingMode === "stripe" && !!c.stripe.subscriptionId;
  const cycle = cycleOf(c.cycle);
  const amount = billed(c);
  const next = c.nextBillingDate;
  const dueIn = next ? daysBetween(today, next) : null;
  const overdue =
    !automatic && c.status === "active" && dueIn !== null && dueIn < 0;
  const card = c.stripe.card;
  const cardExpired =
    !!card.expYear &&
    `${card.expYear}-${String(card.expMonth).padStart(2, "0")}` <
      today.slice(0, 7);

  const actionsClient: BillingClient = {
    slug: c.slug,
    name: c.name,
    contactName: c.contact.name,
    email: c.contact.email,
    whatsapp: c.contact.whatsapp || c.contact.phone,
    currency: c.currency,
    amount,
    setupFee: c.setupFee,
    paymentMethod: c.paymentMethod,
    nextBillingDate: next,
    automatic,
    status: c.status,
    cancelAtPeriodEnd: c.stripe.cancelAtPeriodEnd,
    paused: c.status === "paused",
    stripeReady,
    hasLink: !automatic && !!c.stripe.checkoutUrl,
    today,
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative border-b border-border p-5 sm:p-6">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -top-20 -right-10 size-56 rounded-full blur-[80px] ${
            automatic ? "bg-primary/25" : "bg-accent/10"
          }`}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold [&_svg]:size-4 [&_svg]:text-primary">
              <Repeat /> Billing
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {money(amount, c.currency)} every {cycle.every}
              {c.cycle === "yearly" && " (prepaid)"}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
              automatic
                ? "border-primary/35 bg-primary/12 text-primary"
                : "border-border-strong bg-muted text-muted-foreground"
            }`}
          >
            {automatic ? (
              <Zap className="size-3.5" />
            ) : (
              <HandCoins className="size-3.5" />
            )}
            {automatic ? "Automatic · Stripe" : "Manual"}
          </span>
        </div>

        <div className="relative mt-5 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          {automatic ? (
            <Tile
              icon={<CreditCard />}
              label="Card on file"
              tone={cardExpired ? "danger" : undefined}
              value={
                card.last4 ? (
                  <span className="inline-flex items-center gap-2">
                    <CardMark brand={card.brand} />
                    {BRAND[card.brand] ?? card.brand} ·{card.last4}
                  </span>
                ) : (
                  "Card added"
                )
              }
              note={
                card.expMonth
                  ? `${cardExpired ? "Expired" : "Expires"} ${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)}`
                  : "Kept by Stripe"
              }
            />
          ) : (
            <Tile
              icon={<HandCoins />}
              label="Pays by"
              value={methodLabel(c.paymentMethod)}
              note={
                stripeReady
                  ? "You record each payment"
                  : "You record each payment (Stripe isn't set up)"
              }
            />
          )}
          <Tile
            icon={
              c.status === "paused" ? (
                <PauseCircle />
              ) : overdue ? (
                <AlertTriangle />
              ) : (
                <CalendarClock />
              )
            }
            label={automatic ? "Next charge" : "Next payment"}
            tone={
              overdue || c.status === "past_due"
                ? "danger"
                : dueIn !== null && dueIn <= 7 && dueIn >= 0
                  ? "warn"
                  : undefined
            }
            value={
              c.status === "paused"
                ? "Paused"
                : c.status === "cancelled"
                  ? "Ended"
                  : c.stripe.cancelAtPeriodEnd
                    ? "None"
                    : next
                      ? longDate(next)
                      : "—"
            }
            note={
              c.status === "paused"
                ? c.stripe.resumesAt
                  ? `Resumes ${longDate(c.stripe.resumesAt.slice(0, 10))}`
                  : "Until you resume"
                : c.status === "cancelled"
                  ? "Not billed any more"
                  : c.stripe.cancelAtPeriodEnd
                    ? `Ends ${longDate(c.stripe.currentPeriodEnd.slice(0, 10))}, nothing more charged`
                    : c.status === "past_due"
                      ? "The last charge failed"
                      : dueIn === null
                        ? "No date set"
                        : overdue
                          ? `Overdue by ${-dueIn} day${dueIn === -1 ? "" : "s"}`
                          : `${money(amount, c.currency)} ${relativeDays(dueIn)}${automatic ? ", charged by Stripe" : ""}`
            }
          />
        </div>

        {c.status === "past_due" && c.stripe.lastPaymentError && (
          <p
            role="alert"
            className="relative mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              {c.stripe.lastPaymentError} Send them a new card link if their
              card changed.
            </span>
          </p>
        )}
        {cardExpired && c.status !== "cancelled" && (
          <p className="relative mt-4 flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-sm text-accent">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Their card has expired. Send them a new card link before the next
            charge.
          </p>
        )}

        {!automatic && c.stripe.checkoutUrl && (
          <div className="relative mt-4">
            <SendLink
              client={actionsClient}
              link={{
                url: c.stripe.checkoutUrl,
                expiresAt: c.stripe.checkoutExpiresAt,
                kind: "start",
              }}
            />
          </div>
        )}

        <div className="relative mt-5">
          <BillingActions client={actionsClient} />
        </div>
      </div>

      {/* ───── setup fee ───── */}
      {c.setupFee > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <p className="text-sm font-medium">
              Setup fee · {money(c.setupFee, c.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              One time, paid by hand at the start.
            </p>
          </div>
          <SetupPaidSwitch slug={c.slug} paid={c.setupPaid} />
        </div>
      )}

      {/* ───── history ───── */}
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Receipt className="size-4 text-primary" /> Payments
          </h3>
          {totals.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Paid in total:{" "}
              <span className="font-medium text-foreground">
                {totals.map((t) => money(t.amount, t.currency)).join(" + ")}
              </span>
            </p>
          )}
        </div>
        {payments.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted-foreground">
            No payments yet. Stripe&apos;s charges appear here by themselves;
            record the others with “Record payment”.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {payments.map((p) => (
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
                  <p className="truncate text-sm font-medium">
                    {money(p.amount, p.currency)}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {p.kind === "setup" ? "Setup fee" : "Subscription"}
                      {p.periodStart && p.periodEnd && p.kind === "subscription"
                        ? `, ${longDate(p.periodStart)} – ${longDate(p.periodEnd)}`
                        : ""}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "Asia/Beirut",
                    }).format(new Date(p.paidAt))}{" "}
                    ·{" "}
                    {p.source === "stripe"
                      ? "Card, by Stripe"
                      : methodLabel(p.method)}
                    {p.note && ` · ${p.note}`}
                  </p>
                </div>
                {p.invoiceUrl && (
                  <a
                    href={p.invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Open the invoice"
                  >
                    <FileText className="size-3.5" />
                    {p.invoiceNumber || "Invoice"}
                    <ExternalLink className="size-3" />
                  </a>
                )}
                {p.source === "manual" && (
                  <DeletePaymentButton slug={c.slug} id={p.id} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Tile({
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
  return (
    <div className="rounded-xl border border-border bg-elevated/50 p-4">
      <p className="flex items-center gap-2 text-xs text-muted-foreground [&_svg]:size-3.5">
        <span
          className={
            tone === "danger"
              ? "text-destructive"
              : tone === "warn"
                ? "text-accent"
                : "text-primary"
          }
        >
          {icon}
        </span>
        {label}
      </p>
      <p
        className={`mt-1.5 truncate text-lg font-semibold tracking-tight ${tone === "danger" ? "text-destructive" : ""}`}
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

function CardMark({ brand }: { brand: string }) {
  const color =
    brand === "visa"
      ? "#1a1f71"
      : brand === "mastercard"
        ? "#eb001b"
        : brand === "amex"
          ? "#2e77bb"
          : "#64748b";
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-6 rounded-[3px]"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
    />
  );
}
