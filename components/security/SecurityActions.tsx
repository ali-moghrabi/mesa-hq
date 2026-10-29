"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { CircleCheck, Loader2, X } from "lucide-react";
import {
  changePassword,
  moveToNewPhone,
  renewBackupCodes,
  signOutEverywhere,
  type CodesState,
  type MoveState,
  type PasswordState,
} from "@/lib/auth/actions";
import { CodeField, FormError } from "./CodeField";
import { QrPanel } from "./QrPanel";
import { RecoveryCodes } from "./RecoveryCodes";

const outline =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-elevated/60 px-3.5 text-sm font-medium transition-colors hover:border-border-strong hover:bg-elevated disabled:opacity-60";
const primary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
const danger =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-destructive px-4 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-60";
const field =
  "h-11 w-full rounded-xl border border-border bg-background/60 px-3.5 text-[15px] outline-none transition-[border-color,box-shadow] hover:border-foreground/25 focus:border-primary focus:ring-3 focus:ring-primary/20";

function DialogButton({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [round, setRound] = useState(0);
  const router = useRouter();
  const titleId = useId();
  const open = () => {
    setRound((r) => r + 1);
    ref.current?.showModal();
  };

  return (
    <>
      <button type="button" onClick={open} className={outline}>
        {label}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={() => router.refresh()}
        className="m-auto max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-border-strong bg-card p-0 text-foreground shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop:bg-black/65 backdrop:backdrop-blur-sm"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              onClick={closeDialog}
              aria-label="Close"
              className="-mt-1 -mr-2 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <div key={round} className="mt-2">
            {round > 0 && children}
          </div>
        </div>
      </dialog>
    </>
  );
}

const closeDialog = (event: MouseEvent<HTMLElement>) =>
  event.currentTarget.closest("dialog")?.close();

function Submit({
  children,
  className = primary,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} w-full`}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

const Hint = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-pretty text-muted-foreground">{children}</p>
);

export function RenewCodesButton({ account }: { account: string }) {
  return (
    <DialogButton label="Make new codes" title="New backup codes">
      <RenewCodes account={account} />
    </DialogButton>
  );
}

function RenewCodes({ account }: { account: string }) {
  const [state, action, pending] = useActionState<CodesState, FormData>(
    renewBackupCodes,
    undefined,
  );
  if (state?.codes)
    return (
      <div className="space-y-4">
        <Hint>Your old backup codes no longer work.</Hint>
        <RecoveryCodes codes={state.codes} account={account} />
        <button
          type="button"
          onClick={closeDialog}
          className={`${primary} w-full`}
        >
          Done
        </button>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <Hint>Enter a code from your app to make 10 new ones.</Hint>
      <FormError message={pending ? undefined : state?.error} />
      <CodeField
        id="renew-code"
        allowBackup
        invalid={!!state?.error && !pending}
      />
      <Submit>Make new codes</Submit>
    </form>
  );
}

export function MovePhoneButton() {
  return (
    <DialogButton label="Move to a new phone" title="Move to a new phone">
      <MovePhone />
    </DialogButton>
  );
}

function MovePhone() {
  const [state, action, pending] = useActionState<MoveState, FormData>(
    moveToNewPhone,
    undefined,
  );
  const error = pending ? undefined : state?.error;

  if (state?.step === "done" && state.codes)
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <CircleCheck className="size-4" /> Moved. Your old phone&apos;s codes
          no longer work.
        </p>
        <RecoveryCodes codes={state.codes} account={state.account ?? ""} />
        <button
          type="button"
          onClick={closeDialog}
          className={`${primary} w-full`}
        >
          Done
        </button>
      </div>
    );

  if (state?.step === "scan" && state.qr && state.secret)
    return (
      <form action={action} className="space-y-4">
        <input type="hidden" name="step" value="confirm" />
        <Hint>
          Scan this with the app on your new phone, then enter the code it
          shows.
        </Hint>
        <QrPanel
          qr={state.qr}
          uri={state.uri}
          secret={state.secret}
          account={state.account ?? ""}
        />
        <FormError message={error} />
        <CodeField
          id="move-new"
          label="Code from the new phone"
          invalid={!!error}
        />
        <Submit>Finish the move</Submit>
      </form>
    );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="step" value="start" />
      <Hint>
        First, a code from your current app (or a backup code, if the old phone
        is gone).
      </Hint>
      <FormError message={error} />
      <CodeField id="move-old" allowBackup invalid={!!error} />
      <Submit>Continue</Submit>
    </form>
  );
}

export function ChangePasswordButton() {
  return (
    <DialogButton label="Change password" title="Change password">
      <ChangePassword />
    </DialogButton>
  );
}

function ChangePassword() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(
    changePassword,
    undefined,
  );
  if (state?.done)
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <CircleCheck className="size-4" /> Password changed.
        </p>
        <Hint>
          Every other device was signed out. This one stays signed in.
        </Hint>
        <button
          type="button"
          onClick={closeDialog}
          className={`${primary} w-full`}
        >
          Done
        </button>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <FormError message={pending ? undefined : state?.error} />
      <Labeled label="Current password">
        <input
          name="current"
          type="password"
          autoComplete="current-password"
          required
          className={field}
        />
      </Labeled>
      <Labeled
        label="New password"
        hint="At least 12 characters. A few random words works well."
      >
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          className={field}
        />
      </Labeled>
      <Labeled label="New password again">
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          className={field}
        />
      </Labeled>
      <CodeField
        id="password-code"
        label="Code from your app"
        autoSubmit={false}
        autoFocus={false}
        allowBackup
      />
      <Submit>Change password</Submit>
    </form>
  );
}

function Labeled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}

export function SignOutEverywhereButton() {
  return (
    <DialogButton label="Sign out everywhere" title="Sign out everywhere?">
      <form action={signOutEverywhere} className="space-y-4">
        <Hint>
          Every device signed in to your account, this one too, will need the
          password and a code again.
        </Hint>
        <Submit className={danger}>Sign out everywhere</Submit>
      </form>
    </DialogButton>
  );
}
