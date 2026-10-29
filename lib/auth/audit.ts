import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import type { Types } from "mongoose";
import { sendAlert } from "../health/notify";
import {
  SecurityEvent,
  type SecurityEventType,
} from "../models/security-event";

export type RequestMeta = { ip: string; userAgent: string };

export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const ip =
    h.get("x-real-ip")?.trim() ||
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    "unknown";
  return {
    ip: ip.slice(0, 64),
    userAgent: (h.get("user-agent") ?? "").slice(0, 300),
  };
}

export function deviceLabel(userAgent: string): string {
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "A browser";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "an unknown system";
  return `${browser} on ${os}`;
}

const ALERTS: Partial<
  Record<
    SecurityEventType,
    { title: string; tone: "warning" | "info"; why?: string }
  >
> = {
  "sign-in": { title: "New sign-in to MESA HQ", tone: "info" },
  "sign-in-locked": {
    title: "HQ sign-in locked after wrong passwords",
    tone: "warning",
    why: "Someone kept trying wrong passwords. If it wasn't you, change your password.",
  },
  "codes-locked": {
    title: "HQ two-step codes locked",
    tone: "warning",
    why: "The password was right, but the codes kept failing. If it wasn't you, change your password now.",
  },
  "backup-code-used": {
    title: "A backup code was used to sign in to HQ",
    tone: "warning",
    why: "Each backup code works once. Make new ones from the Security page if you're running low.",
  },
  "mfa-enabled": {
    title: "Two-step sign-in turned on for an HQ account",
    tone: "warning",
    why: "Normal the first time an account signs in. If it wasn't you, someone has this password: reset it with npm run create-admin now.",
  },
  "mfa-moved": {
    title: "Two-step sign-in moved to a new phone",
    tone: "warning",
  },
  "password-changed": {
    title: "An HQ password was changed",
    tone: "warning",
    why: "Every other device was signed out.",
  },
  "signed-out-everywhere": {
    title: "Signed out of HQ everywhere",
    tone: "info",
  },
};

export async function logEvent(
  type: SecurityEventType,
  who: { adminId?: Types.ObjectId | string; email?: string; name?: string },
  meta?: RequestMeta,
): Promise<void> {
  const m = meta ?? (await requestMeta());
  await SecurityEvent.create({
    type,
    adminId: who.adminId,
    email: who.email?.slice(0, 200),
    ip: m.ip,
    userAgent: m.userAgent,
  }).catch((error: unknown) =>
    console.error("[security] Couldn't log the event:", error),
  );

  const alert = ALERTS[type];
  if (!alert || !who.adminId) return;
  const when = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Beirut",
  }).format(new Date());
  after(() =>
    sendAlert({
      title: alert.title,
      tone: alert.tone,
      path: "/security",
      lines: [
        `${who.name || who.email || "Unknown account"}`,
        `${deviceLabel(m.userAgent)} · IP ${m.ip}`,
        when,
        ...(alert.why ? [alert.why] : []),
      ],
    }).then(() => undefined),
  );
}
