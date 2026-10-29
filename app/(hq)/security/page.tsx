import type { Metadata } from "next";
import { SecurityView } from "@/components/security/SecurityView";
import { securityPageData } from "@/lib/auth/security-log";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const me = await requireAdmin(["owner"]);
  const { state, events, failed, now } = await securityPageData(me.id);

  return (
    <SecurityView
      me={{ email: me.email, name: me.name }}
      state={state}
      events={events}
      failed={failed}
      now={now}
    />
  );
}
