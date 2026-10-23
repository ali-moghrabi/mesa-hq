"use client";

import { useActionState } from "react";
import {
  AlertCircle,
  BellRing,
  Check,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import {
  checkAllNow,
  checkClientNow,
  sendTestAlert,
  type CheckState,
  type TestAlertState,
} from "@/lib/health/actions";
import { STATE_LABEL } from "@/lib/health/state";

const button =
  "inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-elevated/60 px-3.5 text-sm font-medium transition-colors hover:border-border-strong hover:bg-elevated disabled:opacity-60 [&_svg]:size-4";

export function CheckNowButton({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<CheckState>(
    checkClientNow.bind(null, slug),
    undefined,
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <span className="text-sm" aria-live="polite">
        {pending ? null : state?.message ? (
          <span className="flex items-center gap-1.5 text-destructive">
            <AlertCircle className="size-3.5" /> {state.message}
          </span>
        ) : state?.state ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Check className="size-3.5 text-success" /> Checked:{" "}
            {STATE_LABEL[state.state].toLowerCase()}
          </span>
        ) : null}
      </span>
      <button type="submit" disabled={pending} className={button}>
        {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        {pending ? "Checking…" : "Check now"}
      </button>
    </form>
  );
}

export function CheckAllButton() {
  const [state, action, pending] = useActionState<CheckState>(
    checkAllNow,
    undefined,
  );
  return (
    <form action={action} className="contents">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_14px_30px_-14px_var(--primary)] transition-all hover:brightness-110 active:translate-y-px disabled:opacity-70 [&_svg]:size-4"
      >
        {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        {pending ? "Checking…" : "Check all now"}
      </button>
      {state?.message && !pending && (
        <p
          role="status"
          className="w-full text-sm text-muted-foreground sm:order-last"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

export function TestAlertButton() {
  const [state, action, pending] = useActionState<TestAlertState>(
    sendTestAlert,
    undefined,
  );
  return (
    <form action={action} className="contents">
      <button type="submit" disabled={pending} className={button}>
        {pending ? <Loader2 className="animate-spin" /> : <BellRing />}
        {pending ? "Sending…" : "Send a test alert"}
      </button>
      {!pending && (state?.results || state?.message) && (
        <div
          role="status"
          className="flex w-full flex-wrap gap-2 sm:order-last"
        >
          {state.message && (
            <p className="text-sm text-muted-foreground">{state.message}</p>
          )}
          {state.results?.map((r) => (
            <span
              key={r.channel}
              title={r.error}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                r.sent
                  ? "border-success/25 bg-success/10 text-success"
                  : "border-destructive/25 bg-destructive/10 text-destructive"
              }`}
            >
              {r.sent ? (
                <Check className="size-3.5" />
              ) : (
                <X className="size-3.5" />
              )}
              <span className="truncate">
                {r.channel === "whatsapp" ? "WhatsApp" : "Email"}{" "}
                {r.sent ? "sent" : `failed: ${r.error}`}
              </span>
            </span>
          ))}
        </div>
      )}
    </form>
  );
}
