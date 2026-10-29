"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { CodeField, FormError } from "@/components/security/CodeField";
import { cancelSignIn, verifyCode, type CodeState } from "@/lib/auth/actions";

export function VerifyForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(
    verifyCode,
    undefined,
  );

  if (state?.restart)
    return (
      <div className="mt-8 space-y-5">
        <FormError message={state.error} />
        <Link
          href="/sign-in"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground"
        >
          Sign in again <ArrowRight className="size-4.5" />
        </Link>
      </div>
    );

  return (
    <>
      <form action={action} className="mt-8 space-y-5">
        {next && <input type="hidden" name="next" value={next} />}
        <FormError message={pending ? undefined : state?.error} />
        <CodeField allowBackup invalid={!!state?.error && !pending} />
        <button
          type="submit"
          disabled={pending}
          className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-[0_14px_30px_-14px_var(--primary)] transition-all hover:brightness-105 active:translate-y-px disabled:opacity-70"
        >
          {pending ? (
            <>
              <Loader2 className="size-4.5 animate-spin" /> Checking…
            </>
          ) : (
            <>
              Sign in{" "}
              <ArrowRight className="size-4.5 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>
      <form action={cancelSignIn} className="mt-6 text-center">
        <button
          type="submit"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Not you? Start over
        </button>
      </form>
      <p className="mt-8 rounded-xl border border-border bg-card/60 px-4 py-3 text-xs leading-relaxed text-pretty text-muted-foreground">
        Lost your phone and your backup codes? Ask the other owner to run{" "}
        <code className="font-mono text-foreground/80">
          npm run reset-2fa your@email
        </code>
        , then sign in again to set it up on your new phone.
      </p>
    </>
  );
}
