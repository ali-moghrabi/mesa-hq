"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, KeyRound, Smartphone } from "lucide-react";

const input =
  "h-14 w-full rounded-xl border border-border bg-card px-4 text-center font-mono text-2xl font-semibold tracking-[0.35em] outline-none transition-[border-color,box-shadow] placeholder:tracking-[0.35em] placeholder:text-muted-foreground/35 hover:border-foreground/25 focus:border-primary focus:ring-3 focus:ring-primary/20 aria-invalid:border-destructive";

/**
 * The 6-digit code box. Submits by itself once 6 digits are in (typed or pasted).
 * With `allowBackup`, a link switches it to a backup code (xxxxx-xxxxx).
 */
export function CodeField({
  id = "code",
  label = "6-digit code",
  allowBackup = false,
  autoSubmit = true,
  autoFocus = true,
  invalid = false,
  disabled = false,
}: {
  id?: string;
  label?: string;
  allowBackup?: boolean;
  autoSubmit?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [backup, setBackup] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {backup ? "Backup code" : label}
        </label>
        {allowBackup && (
          <button
            type="button"
            onClick={() => {
              setBackup((b) => !b);
              requestAnimationFrame(() => document.getElementById(id)?.focus());
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            {backup ? (
              <>
                <Smartphone className="size-3.5" /> Use the app instead
              </>
            ) : (
              <>
                <KeyRound className="size-3.5" /> Use a backup code
              </>
            )}
          </button>
        )}
      </div>
      <input
        key={backup ? "backup" : "app"}
        id={id}
        name="code"
        required
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        {...(backup
          ? {
              type: "text",
              autoComplete: "off",
              maxLength: 11,
              placeholder: "xxxxx-xxxxx",
              className: `${input} text-xl tracking-[0.12em] placeholder:tracking-[0.12em]`,
            }
          : {
              type: "text",
              inputMode: "numeric" as const,
              autoComplete: "one-time-code",
              maxLength: 7,
              placeholder: "000000",
              className: input,
              onInput: (e: FormEvent<HTMLInputElement>) => {
                const el = e.currentTarget;
                const digits = el.value.replace(/\D/g, "").slice(0, 6);
                if (el.value !== digits) el.value = digits;
                if (autoSubmit && digits.length === 6) el.form?.requestSubmit();
              },
            })}
      />
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2.5 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" /> {message}
    </p>
  );
}
