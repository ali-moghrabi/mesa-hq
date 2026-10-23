"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../auth/session";
import { sendAlert, type ChannelResult } from "./notify";
import { runHealthChecks } from "./run";
import type { OverallState } from "./state";

export type CheckState =
  | { message?: string; state?: OverallState; at?: number }
  | undefined;

export async function checkClientNow(
  slug: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _previous: CheckState,
): Promise<CheckState> {
  await requireAdmin(["owner"]);
  try {
    const summary = await runHealthChecks({ slugs: [slug], forceExpiry: true });
    const result = summary.results[0];
    revalidatePath(`/clients/${slug}`);
    revalidatePath("/health");
    revalidatePath("/clients");
    if (!result) return { message: "This client no longer exists." };
    return { state: result.state, at: Date.now() };
  } catch (error) {
    console.error("[health] Check now failed", error);
    return { message: "The check couldn't run. Try again in a moment." };
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function checkAllNow(_previous: CheckState): Promise<CheckState> {
  await requireAdmin(["owner"]);
  try {
    const summary = await runHealthChecks();
    revalidatePath("/health");
    revalidatePath("/clients");
    return {
      message: summary.checked
        ? `Checked ${summary.checked} client${summary.checked === 1 ? "" : "s"} in ${(summary.ms / 1000).toFixed(1)}s${summary.down ? `: ${summary.down} down` : ", all fine"}.`
        : "No live client has a domain or an API address to check yet.",
      at: Date.now(),
    };
  } catch (error) {
    console.error("[health] Check all failed", error);
    return { message: "The checks couldn't run. Try again in a moment." };
  }
}

export type TestAlertState =
  | { results?: ChannelResult[]; message?: string; at?: number }
  | undefined;

export async function sendTestAlert(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _previous: TestAlertState,
): Promise<TestAlertState> {
  const me = await requireAdmin(["owner"]);
  const when = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Beirut",
  }).format(new Date());
  const results = await sendAlert({
    tone: "info",
    title: "Test alert from MESA HQ",
    lines: [
      "If you can read this, health alerts reach you here.",
      `Sent by ${me.email} on ${when}.`,
    ],
    path: "/health",
  });
  return results.length
    ? { results, at: Date.now() }
    : {
        message:
          "No alert channel is set up yet. Add the WhatsApp or email settings to .env.local, then restart HQ.",
        at: Date.now(),
      };
}
