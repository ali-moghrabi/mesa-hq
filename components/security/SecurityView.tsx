import type { ReactNode } from "react";
import {
  CircleCheck,
  KeyRound,
  LogIn,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Smartphone,
  TriangleAlert,
  UserX,
} from "lucide-react";
import type { SecurityRow } from "@/lib/auth/security-log";
import type { SecurityEventType } from "@/lib/models/security-event";
import {
  ChangePasswordButton,
  MovePhoneButton,
  RenewCodesButton,
  SignOutEverywhereButton,
} from "./SecurityActions";

type Tone = "good" | "warn" | "bad" | "info";

const EVENTS: Record<
  SecurityEventType,
  { label: string; tone: Tone; icon: ReactNode }
> = {
  "sign-in": { label: "Signed in", tone: "good", icon: <LogIn /> },
  "sign-in-failed": {
    label: "Wrong password",
    tone: "warn",
    icon: <TriangleAlert />,
  },
  "sign-in-locked": {
    label: "Sign-in locked: too many wrong passwords",
    tone: "bad",
    icon: <LockKeyhole />,
  },
  "code-failed": { label: "Wrong code", tone: "warn", icon: <TriangleAlert /> },
  "codes-locked": {
    label: "Codes locked: too many wrong codes",
    tone: "bad",
    icon: <LockKeyhole />,
  },
  "backup-code-used": {
    label: "Signed in with a backup code",
    tone: "warn",
    icon: <KeyRound />,
  },
  "mfa-enabled": {
    label: "Two-step sign-in turned on",
    tone: "info",
    icon: <ShieldCheck />,
  },
  "mfa-moved": {
    label: "Moved to a new phone",
    tone: "info",
    icon: <Smartphone />,
  },
  "codes-renewed": {
    label: "New backup codes made",
    tone: "info",
    icon: <KeyRound />,
  },
  "password-changed": {
    label: "Password changed",
    tone: "info",
    icon: <KeyRound />,
  },
  "signed-out-everywhere": {
    label: "Signed out everywhere",
    tone: "info",
    icon: <UserX />,
  },
  "mfa-reset": {
    label: "Two-step sign-in reset from the server",
    tone: "bad",
    icon: <ShieldX />,
  },
};

const TONE: Record<Tone, string> = {
  good: "bg-success/12 text-success",
  warn: "bg-accent/12 text-accent",
  bad: "bg-destructive/12 text-destructive",
  info: "bg-primary/12 text-primary",
};

const when = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Beirut",
});
const day = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Asia/Beirut",
});

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : day.format(new Date(iso));
}

export function SecurityView({
  me,
  state,
  events,
  failed,
  now,
}: {
  me: { email: string; name: string };
  state: { enabled: boolean; enabledAt?: string; recoveryCodesLeft: number };
  events: SecurityRow[];
  failed: number;
  now: number;
}) {
  const low = state.recoveryCodesLeft <= 3;

  return (
    <>
      <div>
        <p className="text-sm font-medium text-primary">Account</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Security</h1>
        <p className="mt-1.5 text-muted-foreground">
          Your two-step sign-in, and every sign-in to HQ.
        </p>
      </div>

      <section className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
        <Tile
          icon={state.enabled ? <ShieldCheck /> : <ShieldAlert />}
          tone={state.enabled ? "good" : "bad"}
          label="Two-step sign-in"
          value={state.enabled ? "On" : "Off"}
          note={
            state.enabled && state.enabledAt
              ? `Since ${day.format(new Date(state.enabledAt))}`
              : "Sign out and in again to set it up"
          }
        />
        <Tile
          icon={<KeyRound />}
          tone={low ? "warn" : "info"}
          label="Backup codes left"
          value={`${state.recoveryCodesLeft} of 10`}
          note={low ? "Running low: make new ones" : "Each works once"}
        />
        <Tile
          icon={<TriangleAlert />}
          tone={failed >= 5 ? "bad" : failed ? "warn" : "good"}
          label="Failed tries, last 24 h"
          value={String(failed)}
          note={failed ? "Wrong passwords and codes" : "Nobody knocking"}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Your account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {me.name ? `${me.name} · ` : ""}
          {me.email}
        </p>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
          <Card
            icon={<KeyRound />}
            title="Backup codes"
            text="New codes replace the old ones. Do it if some were used or might have been seen."
            action={<RenewCodesButton account={me.email} />}
          />
          <Card
            icon={<Smartphone />}
            title="New phone"
            text="Move your codes to another phone or app. The old one stops working."
            action={<MovePhoneButton />}
          />
          <Card
            icon={<LockKeyhole />}
            title="Password"
            text="Needs your current password and a code. Every other device is signed out."
            action={<ChangePasswordButton />}
          />
          <Card
            icon={<UserX />}
            title="Sign out everywhere"
            text="Ends every HQ session of yours, on every device, this one included."
            action={<SignOutEverywhereButton />}
          />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
          <p className="text-xs text-muted-foreground">
            Everyone&apos;s, kept 180 days
          </p>
        </div>
        {events.length ? (
          <ol className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {events.map((e) => {
              const meta = EVENTS[e.type] ?? {
                label: e.type,
                tone: "info" as const,
                icon: <CircleCheck />,
              };
              return (
                <li
                  key={e.id}
                  className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-3 px-4 py-3 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto]"
                >
                  <span
                    className={`grid size-9 place-items-center rounded-xl [&_svg]:size-4 ${TONE[meta.tone]}`}
                  >
                    {meta.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{meta.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[e.email, e.device, e.ip && `IP ${e.ip}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <time
                    dateTime={e.at}
                    title={when.format(new Date(e.at))}
                    className="col-start-2 mt-0.5 text-xs text-muted-foreground tabular-nums sm:col-start-auto sm:mt-0"
                  >
                    {ago(e.at, now)}
                  </time>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing yet. Sign-ins and changes will show here.
          </p>
        )}
      </section>
    </>
  );
}

function Tile({
  icon,
  tone,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  tone: Tone;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <span
        className={`grid size-9 place-items-center rounded-xl [&_svg]:size-4.5 ${TONE[tone]}`}
      >
        {icon}
      </span>
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Card({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground [&_svg]:size-4.5">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            {text}
          </p>
        </div>
      </div>
      <div className="mt-auto flex justify-end pt-4">{action}</div>
    </div>
  );
}
