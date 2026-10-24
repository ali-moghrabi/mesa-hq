import type { Metadata } from "next";
import { RequestsView } from "@/components/onboarding/RequestsView";
import { requireAdmin } from "@/lib/auth/session";
import { listRequests, parseRequestFilter } from "@/lib/onboarding/queries";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : "";
  };
  const filter = parseRequestFilter(one("status") || "open");
  const q = one("q").trim().slice(0, 80);
  const { rows, counts, now } = await listRequests(filter, q);

  return (
    <RequestsView
      rows={rows}
      counts={counts}
      filter={filter}
      q={q}
      now={now}
      deleted={one("deleted").slice(0, 80) || undefined}
    />
  );
}
