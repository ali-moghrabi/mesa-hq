"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  Ban,
  CalendarPlus,
  Check,
  CheckCircle2,
  CreditCard,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  cancelBilling,
  createCardLink,
  createCardUpdateLink,
  deletePayment,
  pauseBilling,
  recordPayment,
  refreshBilling,
  resumeBilling,
  setSetupPaid,
  undoCancel,
  type BillingState,
} from "@/lib/billing/actions";
import { PAYMENT_METHODS } from "@/lib/clients/options";
import { CopyButton } from "@/components/clients/CopyButton";

const BUTTON =
  "inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-elevated/60 px-3.5 text-sm font-medium transition-colors hover:border-border-strong hover:bg-elevated disabled:opacity-60 [&_svg]:size-4";
const PRIMARY =
  "inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_14px_30px_-14px_var(--primary)] transition-all hover:brightness-110 active:translate-y-px disabled:opacity-60 [&_svg]:size-4";
const FIELD =
  "mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-[15px] outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-3 focus:ring-primary/20";

export type BillingClient = {
  slug: string;
  name: string;
  contactName: string;
  email: string;
  whatsapp: string;
  currency: string;
  amount: number;
  setupFee: number;
  paymentMethod: string;
  nextBillingDate: string;
  automatic: boolean;
  status: string;
  cancelAtPeriodEnd: boolean;
  paused: boolean;
  stripeReady: boolean;
  hasLink: boolean;
  today: string;
};

export function BillingActions({ client: c }: { client: BillingClient }) {
  const [link, setLink] = useState<{
    url: string;
    expiresAt?: string;
    kind: "start" | "card";
  } | null>(null);
  const ended = c.status === "cancelled";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {!c.automatic && !ended && (
          <LinkButton
            label={c.hasLink ? "Make a new link" : "Turn on automatic billing"}
            pendingLabel="Making the link…"
            icon={<CreditCard />}
            primary
            disabled={!c.stripeReady}
            run={() => createCardLink(c.slug)}
            onLink={() => setLink(null)}
          />
        )}
        {c.automatic && (
          <LinkButton
            label="New card link"
            pendingLabel="Making the link…"
            icon={<CreditCard />}
            run={() => createCardUpdateLink(c.slug)}
            onLink={(url, expiresAt) =>
              setLink({ url, expiresAt, kind: "card" })
            }
          />
        )}
        {!ended && <RecordPaymentButton client={c} />}
        {!ended &&
          (c.status === "paused" ? (
            <SimpleButton
              label="Resume billing"
              pendingLabel="Resuming…"
              icon={<PlayCircle />}
              run={() => resumeBilling(c.slug)}
            />
          ) : (
            <PauseButton client={c} />
          ))}
        {c.automatic && c.cancelAtPeriodEnd ? (
          <SimpleButton
            label="Keep billing them"
            pendingLabel="Saving…"
            icon={<Undo2 />}
            run={() => undoCancel(c.slug)}
          />
        ) : (
          !ended && <CancelButton client={c} />
        )}
        {c.automatic && (
          <SimpleButton
            label="Refresh from Stripe"
            pendingLabel="Checking…"
            icon={<RefreshCw />}
            run={() => refreshBilling(c.slug)}
            quiet
          />
        )}
      </div>
      {!c.stripeReady && !c.automatic && !ended && (
        <p className="text-xs text-muted-foreground">
          Automatic billing needs STRIPE_SECRET_KEY in HQ&apos;s environment.
        </p>
      )}
      {link && (
        <SendLink client={c} link={link} onClose={() => setLink(null)} />
      )}
    </div>
  );
}

export function SendLink({
  client: c,
  link,
  onClose,
}: {
  client: BillingClient;
  link: { url: string; expiresAt?: string; kind: "start" | "card" };
  onClose?: () => void;
}) {
  const first = c.contactName.split(/\s+/)[0] || "there";
  const text =
    link.kind === "start"
      ? `Hi ${first}, here's the secure Stripe page to add your card for your MESA website subscription. From now on it renews by itself, no need to send payments by hand: ${link.url}`
      : `Hi ${first}, here's the secure Stripe page to update the card for your MESA website subscription: ${link.url}`;
  const digits = c.whatsapp.replace(/\D/g, "").replace(/^00/, "");
  const until = link.expiresAt
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Beirut",
      }).format(new Date(link.expiresAt))
    : "";

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/8 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Link2 className="size-4 text-primary" />
          {link.kind === "start" ? "Card link for" : "New card link for"}{" "}
          {c.name}
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Hide the link"
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="mt-3 flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          {link.url}
        </span>
        <CopyButton value={link.url} label="Copy the link" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {digits.length >= 7 && (
          <a
            href={`https://wa.me/${digits}?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noreferrer"
            className={BUTTON}
          >
            <MessageCircle /> Send on WhatsApp
          </a>
        )}
        {c.email && (
          <a
            href={`mailto:${c.email}?subject=${encodeURIComponent("Your MESA subscription")}&body=${encodeURIComponent(text)}`}
            className={BUTTON}
          >
            <Mail /> Email it
          </a>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {until ? `Works until ${until}. ` : ""}
        {link.kind === "start"
          ? "Billing switches to automatic as soon as they add their card: you'll get a message."
          : "Once they add it, any unpaid charge is retried on the new card."}
      </p>
    </div>
  );
}

/* ───────────── small pieces ───────────── */

function Message({
  state,
  pending,
}: {
  state: BillingState;
  pending: boolean;
}) {
  if (pending || !state?.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`flex items-center gap-1.5 text-sm ${state.ok ? "text-success" : "text-destructive"}`}
    >
      {state.ok ? (
        <Check className="size-3.5 shrink-0" />
      ) : (
        <AlertCircle className="size-3.5 shrink-0" />
      )}
      {state.message}
    </p>
  );
}

function SimpleButton({
  label,
  pendingLabel,
  icon,
  run,
  quiet,
}: {
  label: string;
  pendingLabel: string;
  icon: ReactNode;
  run: () => Promise<BillingState>;
  quiet?: boolean;
}) {
  const [state, action, pending] = useActionState<BillingState>(run, undefined);
  return (
    <form action={action} className="contents">
      <button
        type="submit"
        disabled={pending}
        className={
          quiet
            ? `${BUTTON} border-transparent bg-transparent text-muted-foreground`
            : BUTTON
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : icon}
        {pending ? pendingLabel : label}
      </button>
      {state?.message && !pending && (
        <span className="w-full">
          <Message state={state} pending={pending} />
        </span>
      )}
    </form>
  );
}

function LinkButton({
  label,
  pendingLabel,
  icon,
  run,
  onLink,
  primary,
  disabled,
}: {
  label: string;
  pendingLabel: string;
  icon: ReactNode;
  run: () => Promise<BillingState>;
  onLink: (url: string, expiresAt?: string) => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<BillingState>(async () => {
    const result = await run();
    if (result?.url) onLink(result.url, result.expiresAt);
    return result;
  }, undefined);
  return (
    <form action={action} className="contents">
      <button
        type="submit"
        disabled={pending || disabled}
        className={primary ? PRIMARY : BUTTON}
      >
        {pending ? <Loader2 className="animate-spin" /> : icon}
        {pending ? pendingLabel : label}
      </button>
      {state?.message && !state.ok && !pending && (
        <span className="w-full">
          <Message state={state} pending={pending} />
        </span>
      )}
    </form>
  );
}

/** A dialog that opens from a button and closes itself once its action worked */
function DialogButton({
  label,
  icon,
  title,
  text,
  tone = "default",
  children,
}: {
  label: string;
  icon: ReactNode;
  title: string;
  text?: ReactNode;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [round, setRound] = useState(0);
  const close = () => dialog.current?.close();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setRound((r) => r + 1);
          dialog.current?.showModal();
        }}
        className={
          tone === "danger"
            ? `${BUTTON} hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive`
            : BUTTON
        }
      >
        {icon}
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-border-strong bg-card p-0 text-foreground shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop:bg-black/65 backdrop:backdrop-blur-sm"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="-mt-1 -mr-2 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          {text && (
            <div className="mt-1.5 text-sm text-pretty text-muted-foreground">
              {text}
            </div>
          )}
          <div key={round} className="mt-5">
            {round > 0 && children}
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Once the form's action worked, its dialog closes (after a moment to read the message) */
function useCloseOnSuccess(state: BillingState) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state?.ok) return;
    const timer = setTimeout(
      () => form.current?.closest("dialog")?.close(),
      900,
    );
    return () => clearTimeout(timer);
  }, [state]);
  return form;
}

function Submit({
  pending,
  label,
  pendingLabel,
  icon,
  danger,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
  icon: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        danger
          ? "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-destructive px-4 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-60 [&_svg]:size-4"
          : `${PRIMARY} h-11 w-full justify-center`
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : icon}
      {pending ? pendingLabel : label}
    </button>
  );
}

/* ───────────── record a payment ───────────── */

function RecordPaymentButton({ client: c }: { client: BillingClient }) {
  return (
    <DialogButton
      label="Record payment"
      icon={<CalendarPlus />}
      title="Record a payment"
      text={
        c.automatic
          ? "For a payment made outside Stripe. Stripe's own charges are recorded by themselves."
          : "For cash, Whish, OMT or a transfer. The next payment date moves one cycle forward."
      }
    >
      <RecordPaymentForm client={c} />
    </DialogButton>
  );
}

function RecordPaymentForm({ client: c }: { client: BillingClient }) {
  const [state, action, pending] = useActionState<BillingState, FormData>(
    recordPayment.bind(null, c.slug),
    undefined,
  );
  const [kind, setKind] = useState<"subscription" | "setup">("subscription");
  const form = useCloseOnSuccess(state);
  const method = c.paymentMethod === "card" ? "cash" : c.paymentMethod;
  return (
    <form ref={form} action={action} className="space-y-4">
      <div
        className="flex rounded-xl border border-border bg-elevated/60 p-1"
        role="radiogroup"
      >
        {(
          [
            ["subscription", "Subscription"],
            ["setup", "Setup fee"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={kind === id}
            onClick={() => setKind(id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              kind === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Amount ({c.currency})
          <input
            key={kind}
            name="amount"
            inputMode="decimal"
            defaultValue={String(kind === "setup" ? c.setupFee : c.amount)}
            className={FIELD}
            required
          />
        </label>
        <label className="block text-sm">
          Paid on
          <input
            name="paidOn"
            type="date"
            defaultValue={c.today}
            max={c.today}
            className={FIELD}
            required
          />
        </label>
      </div>
      <label className="block text-sm">
        Paid by
        <select name="method" defaultValue={method} className={FIELD}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Note <span className="text-muted-foreground">(optional)</span>
        <input
          name="note"
          maxLength={300}
          placeholder="Whish ref, who received it…"
          className={FIELD}
        />
      </label>
      <Message state={state} pending={pending} />
      <Submit
        pending={pending}
        label="Record payment"
        pendingLabel="Saving…"
        icon={<CheckCircle2 />}
      />
    </form>
  );
}

/* ───────────── pause ───────────── */

function PauseButton({ client: c }: { client: BillingClient }) {
  return (
    <DialogButton
      label="Pause"
      icon={<PauseCircle />}
      title={`Pause ${c.name}'s billing?`}
      text={
        c.automatic
          ? "Stripe stops charging them. Their card and subscription are kept, ready to resume."
          : "They won't be due anything until you resume."
      }
    >
      <PauseForm client={c} />
    </DialogButton>
  );
}

function PauseForm({ client: c }: { client: BillingClient }) {
  const [state, action, pending] = useActionState<BillingState, FormData>(
    pauseBilling.bind(null, c.slug),
    undefined,
  );
  const form = useCloseOnSuccess(state);
  return (
    <form ref={form} action={action} className="space-y-4">
      <label className="block text-sm">
        Resume on <span className="text-muted-foreground">(optional)</span>
        <input name="resumeOn" type="date" min={c.today} className={FIELD} />
        <span className="mt-1.5 block text-xs text-muted-foreground">
          {c.automatic
            ? "Stripe starts charging again by itself on that day. Empty: until you resume."
            : "A reminder for you. Empty: until you resume."}
        </span>
      </label>
      <Message state={state} pending={pending} />
      <Submit
        pending={pending}
        label="Pause billing"
        pendingLabel="Pausing…"
        icon={<PauseCircle />}
      />
    </form>
  );
}

/* ───────────── cancel ───────────── */

function CancelButton({ client: c }: { client: BillingClient }) {
  return (
    <DialogButton
      label="Cancel"
      icon={<Ban />}
      tone="danger"
      title={`Cancel ${c.name}'s subscription?`}
      text="Their website isn't touched: only billing stops."
    >
      <CancelForm client={c} />
    </DialogButton>
  );
}

function CancelForm({ client: c }: { client: BillingClient }) {
  const [state, action, pending] = useActionState<BillingState, FormData>(
    cancelBilling.bind(null, c.slug),
    undefined,
  );
  const [when, setWhen] = useState(c.automatic ? "end" : "now");
  const form = useCloseOnSuccess(state);
  const options = c.automatic
    ? [
        {
          id: "end",
          title: "At the end of the paid period",
          text: "Nothing more is charged. They stay a client until then.",
        },
        {
          id: "now",
          title: "Right away",
          text: "Stripe stops now. No refund is made.",
        },
        {
          id: "manual",
          title: "Switch to manual billing instead",
          text: "Stripe stops, but they stay active and pay you by hand.",
        },
      ]
    : [
        {
          id: "now",
          title: "Cancel now",
          text: "They're marked as cancelled.",
        },
      ];
  return (
    <form ref={form} action={action} className="space-y-4">
      <input type="hidden" name="when" value={when} />
      <div className="space-y-2" role="radiogroup">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={when === o.id}
            onClick={() => setWhen(o.id)}
            className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
              when === o.id
                ? "border-primary bg-primary/8"
                : "border-border hover:border-border-strong"
            }`}
          >
            <span
              className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
                when === o.id ? "border-primary" : "border-border-strong"
              }`}
            >
              {when === o.id && (
                <span className="size-2 rounded-full bg-primary" />
              )}
            </span>
            <span>
              <span className="block text-sm font-medium">{o.title}</span>
              <span className="block text-xs text-muted-foreground">
                {o.text}
              </span>
            </span>
          </button>
        ))}
      </div>
      <Message state={state} pending={pending} />
      <Submit
        pending={pending}
        label={when === "manual" ? "Switch to manual" : "Cancel subscription"}
        pendingLabel="Cancelling…"
        icon={<Ban />}
        danger={when !== "manual"}
      />
    </form>
  );
}

/* ───────────── setup fee switch, and removing a payment ───────────── */

export function SetupPaidSwitch({
  slug,
  paid,
}: {
  slug: string;
  paid: boolean;
}) {
  const [state, action, pending] = useActionState<BillingState>(
    () => setSetupPaid(slug, !paid),
    undefined,
  );
  return (
    <form action={action} className="flex items-center gap-3">
      <button
        type="submit"
        role="switch"
        aria-checked={paid}
        aria-label="Setup fee paid"
        disabled={pending}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          paid ? "bg-success" : "bg-muted-foreground/40"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
            paid ? "translate-x-5" : ""
          }`}
        />
      </button>
      <span className="text-sm">
        {pending ? "Saving…" : paid ? "Paid" : "Not paid yet"}
      </span>
      {state?.message && !state.ok && (
        <Message state={state} pending={pending} />
      )}
    </form>
  );
}

export function DeletePaymentButton({
  slug,
  id,
}: {
  slug: string;
  id: string;
}) {
  const [state, action, pending] = useActionState<BillingState>(
    () => deletePayment(slug, id),
    undefined,
  );
  const [sure, setSure] = useState(false);
  return (
    <form action={action} className="inline-flex items-center">
      {sure ? (
        <button
          type="submit"
          disabled={pending}
          className="rounded-md px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
        >
          {pending ? "Removing…" : "Remove?"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setSure(true)}
          aria-label="Remove this payment"
          title="Recorded by mistake? Remove it"
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
      {state?.message && !state.ok && (
        <span className="ml-2 text-xs text-destructive">{state.message}</span>
      )}
    </form>
  );
}
