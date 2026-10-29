"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { CodeField, FormError } from "@/components/security/CodeField";
import { QrPanel } from "@/components/security/QrPanel";
import { RecoveryCodes } from "@/components/security/RecoveryCodes";
import {
  cancelSignIn,
  confirmSetup,
  type SetupState,
} from "@/lib/auth/actions";

const primary =
  "group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-[0_14px_30px_-14px_var(--primary)] transition-all hover:brightness-105 active:translate-y-px disabled:pointer-events-none disabled:opacity-50";

export function SetupForm({
  next,
  setup,
  signedIn = false,
}: {
  next?: string;
  setup?: { qr: string; uri: string; secret: string; account: string };
  signedIn?: boolean;
}) {
  const [state, action, pending] = useActionState<SetupState, FormData>(
    confirmSetup,
    undefined,
  );
  const [saved, setSaved] = useState(false);

  if (state?.recoveryCodes)
    return (
      <>
        <span className="grid size-12 place-items-center rounded-2xl bg-success/12 text-success">
          <ShieldCheck className="size-6" />
        </span>
        <h2 className="mt-5 text-3xl font-semibold tracking-tight">
          You&apos;re protected
        </h2>
        <p className="mt-2 text-pretty text-muted-foreground">
          From now on, signing in asks for a code from your app.
        </p>
        <div className="mt-6">
          <RecoveryCodes
            codes={state.recoveryCodes}
            account={state.account ?? ""}
          />
        </div>
        <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="size-4.5 accent-primary"
          />
          I&apos;ve saved my backup codes
        </label>
        {saved ? (
          <Link href={state.next ?? "/"} className={`${primary} mt-5`}>
            Go to HQ{" "}
            <ArrowRight className="size-4.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <button type="button" disabled className={`${primary} mt-5`}>
            Go to HQ <ArrowRight className="size-4.5" />
          </button>
        )}
      </>
    );

  if (signedIn || !setup)
    return (
      <div className="space-y-5">
        <h2 className="text-3xl font-semibold tracking-tight">
          You&apos;re signed in
        </h2>
        <Link href={next ?? "/"} className={primary}>
          Go to HQ <ArrowRight className="size-4.5" />
        </Link>
      </div>
    );

  if (state?.restart)
    return (
      <div className="space-y-5">
        <h2 className="text-3xl font-semibold tracking-tight">
          Let&apos;s start again
        </h2>
        <FormError message={state.error} />
        <Link href="/sign-in" className={primary}>
          Sign in again <ArrowRight className="size-4.5" />
        </Link>
      </div>
    );

  return (
    <>
      <p className="text-sm font-medium text-primary">One-time setup</p>
      <h2 className="mt-1 text-3xl font-semibold tracking-tight">
        Protect your account
      </h2>
      <p className="mt-2 text-pretty text-muted-foreground">
        HQ asks for a code from an authenticator app every time you sign in. It
        takes a minute.
      </p>

      <ol className="mt-7 space-y-6">
        <Step n={1} title="Get an authenticator app">
          Google Authenticator, Microsoft Authenticator, 1Password or Authy: any
          of them works, all free.
        </Step>
        <Step n={2} title="Scan this with the app">
          <div className="mt-3">
            <QrPanel {...setup} />
          </div>
        </Step>
        <Step n={3} title="Enter the code it shows">
          <form action={action} className="mt-3 space-y-4">
            {next && <input type="hidden" name="next" value={next} />}
            <FormError message={pending ? undefined : state?.error} />
            <CodeField autoFocus={false} invalid={!!state?.error && !pending} />
            <button type="submit" disabled={pending} className={primary}>
              {pending ? (
                <>
                  <Loader2 className="size-4.5 animate-spin" /> Checking…
                </>
              ) : (
                <>
                  Turn it on{" "}
                  <ArrowRight className="size-4.5 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        </Step>
      </ol>

      <form action={cancelSignIn} className="mt-6 text-center">
        <button
          type="submit"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Not you? Start over
        </button>
      </form>
    </>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3">
      <span className="grid size-7 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary tabular-nums">
        {n}
      </span>
      <div>
        <p className="pt-0.5 font-medium">{title}</p>
        <div className="mt-1 text-sm text-pretty text-muted-foreground">
          {children}
        </div>
      </div>
    </li>
  );
}
