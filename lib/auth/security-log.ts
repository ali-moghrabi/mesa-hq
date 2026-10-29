import "server-only";
import { connectDb } from "../db";
import {
  SecurityEvent,
  type SecurityEventType,
} from "../models/security-event";
import { deviceLabel } from "./audit";
import { securityState } from "./mfa";

export type SecurityRow = {
  id: string;
  type: SecurityEventType;
  email: string;
  device: string;
  ip: string;
  at: string;
};

export async function recentSecurityEvents(limit = 60): Promise<SecurityRow[]> {
  await connectDb();
  const rows = await SecurityEvent.find({})
    .sort({ at: -1 })
    .limit(limit)
    .lean();
  return rows.map((r) => ({
    id: String(r._id),
    type: r.type,
    email: r.email ?? "",
    device: r.userAgent ? deviceLabel(r.userAgent) : "",
    ip: r.ip ?? "",
    at: r.at.toISOString(),
  }));
}

export async function failedLastDay(): Promise<number> {
  await connectDb();
  return SecurityEvent.countDocuments({
    type: { $in: ["sign-in-failed", "code-failed"] },
    at: { $gt: new Date(Date.now() - 24 * 60 * 60_000) },
  });
}

export async function securityPageData(adminId: string) {
  const [state, events, failed] = await Promise.all([
    securityState(adminId),
    recentSecurityEvents(),
    failedLastDay(),
  ]);
  return { state, events, failed, now: Date.now() };
}
