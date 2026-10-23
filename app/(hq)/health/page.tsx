import type { Metadata } from "next";
import { HealthView } from "@/components/health/HealthView";
import { requireAdmin } from "@/lib/auth/session";
import { todayIn } from "@/lib/clients/list";
import { getHealthOverview } from "@/lib/health/queries";

export const metadata: Metadata = { title: "Health" };

export default async function HealthPage() {
  await requireAdmin();
  const data = await getHealthOverview();

  return <HealthView data={data} today={todayIn()} now={data.now} />;
}
