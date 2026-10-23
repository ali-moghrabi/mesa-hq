export const SLOW_MS = 3_000;
export const FAIL_THRESHOLD = 2;
export const EXPIRY_WARN_DAYS = 14;

export type TargetHealth = {
  ok: boolean | null;
  status: number;
  ms: number;
  error: string;
  failures: number;
  down: boolean;
  since: string;
  checkedAt: string;
};

export type ClientHealth = {
  website: TargetHealth;
  api: TargetHealth;
  sslExpiresAt: string;
  sslError: string;
  domainExpiresAt: string;
  expiryCheckedAt: string;
  checkedAt: string;
};

export type TargetState = "unknown" | "up" | "slow" | "failing" | "down";
export type OverallState = TargetState | "warning" | "off";

export function targetState(t: TargetHealth | undefined): TargetState {
  if (!t || t.ok === null || !t.checkedAt) return "unknown";
  if (t.down) return "down";
  if (!t.ok) return "failing";
  return t.ms > SLOW_MS ? "slow" : "up";
}

export function daysUntil(date: string, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000,
  );
}

export function overallState(
  health: ClientHealth | undefined,
  monitored: { website: boolean; api: boolean },
  today: string,
): OverallState {
  if (!monitored.website && !monitored.api) return "off";
  const states = [
    monitored.website ? targetState(health?.website) : null,
    monitored.api ? targetState(health?.api) : null,
  ].filter((s): s is TargetState => s !== null);
  if (states.includes("down")) return "down";
  if (states.includes("failing")) return "failing";
  const expiring = [health?.sslExpiresAt, health?.domainExpiresAt].some((d) => {
    const days = daysUntil(d ?? "", today);
    return days !== null && days <= EXPIRY_WARN_DAYS;
  });
  if (states.includes("slow") || expiring || health?.sslError) return "warning";
  if (states.every((s) => s === "unknown")) return "unknown";
  return "up";
}

export const STATE_LABEL: Record<OverallState, string> = {
  up: "Up",
  slow: "Slow",
  warning: "Warning",
  failing: "Failing",
  down: "Down",
  unknown: "Not checked yet",
  off: "Not monitored",
};

export const STATE_TONE: Record<
  OverallState,
  { dot: string; pill: string; text: string }
> = {
  up: {
    dot: "bg-success",
    pill: "border-success/25 bg-success/10 text-success",
    text: "text-success",
  },
  slow: {
    dot: "bg-accent",
    pill: "border-accent/25 bg-accent/10 text-accent",
    text: "text-accent",
  },
  warning: {
    dot: "bg-accent",
    pill: "border-accent/25 bg-accent/10 text-accent",
    text: "text-accent",
  },
  failing: {
    dot: "bg-accent",
    pill: "border-accent/25 bg-accent/10 text-accent",
    text: "text-accent",
  },
  down: {
    dot: "bg-destructive",
    pill: "border-destructive/25 bg-destructive/10 text-destructive",
    text: "text-destructive",
  },
  unknown: {
    dot: "bg-muted-foreground/50",
    pill: "border-border-strong bg-muted text-muted-foreground",
    text: "text-muted-foreground",
  },
  off: {
    dot: "bg-transparent border border-border-strong",
    pill: "border-border bg-transparent text-muted-foreground",
    text: "text-muted-foreground",
  },
};

export function toClientHealth(raw: unknown): ClientHealth {
  const h = (raw ?? {}) as Record<string, unknown>;
  const iso = (v: unknown) =>
    v instanceof Date
      ? v.toISOString()
      : typeof v === "string" && v
        ? new Date(v).toISOString()
        : "";
  const target = (v: unknown): TargetHealth => {
    const t = (v ?? {}) as Record<string, unknown>;
    return {
      ok: typeof t.ok === "boolean" ? t.ok : null,
      status: Number(t.status ?? 0),
      ms: Number(t.ms ?? 0),
      error: String(t.error ?? ""),
      failures: Number(t.failures ?? 0),
      down: !!t.down,
      since: iso(t.since),
      checkedAt: iso(t.checkedAt),
    };
  };
  return {
    website: target(h.website),
    api: target(h.api),
    sslExpiresAt: String(h.sslExpiresAt ?? ""),
    sslError: String(h.sslError ?? ""),
    domainExpiresAt: String(h.domainExpiresAt ?? ""),
    expiryCheckedAt: iso(h.expiryCheckedAt),
    checkedAt: iso(h.checkedAt),
  };
}

export function ago(iso: string, now: number): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function span(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  return `${Math.round(h / 24)} days`;
}
