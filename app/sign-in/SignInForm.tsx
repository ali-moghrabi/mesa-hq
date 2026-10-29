"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn, type SignInState } from "@/lib/auth/actions";

const input =
  "h-12 w-full rounded-xl border border-border bg-card px-3.5 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 hover:border-foreground/25 focus:border-primary focus:ring-3 focus:ring-primary/20 aria-invalid:border-destructive";

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    signIn,
    undefined,
  );
  const [show, setShow] = useState(false);
  const failed = !!state?.error;

  return (
    <form action={action} className="mt-8 space-y-5">
      {next && <input type="hidden" name="next" value={next} />}

      {state?.error && (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      )}

      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          defaultValue={state?.email}
          aria-invalid={failed || undefined}
          placeholder="you@mesa-template.store"
          className={input}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={failed || undefined}
            className={`${input} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
          >
            {show ? (
              <EyeOff className="size-4.5" />
            ) : (
              <Eye className="size-4.5" />
            )}
          </button>
        </div>
      </div>

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
            Continue{" "}
            <ArrowRight className="size-4.5 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </form>
  );
}
