import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequestDetailView } from "@/components/onboarding/RequestDetailView";
import { requireAdmin } from "@/lib/auth/session";
import { getRequest } from "@/lib/onboarding/queries";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = { title: "Onboarding request" };

export default async function OnboardingRequestPage({
  params,
  searchParams,
}: Props) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const request = await getRequest(id);
  if (!request) notFound();

  return (
    <RequestDetailView
      r={request}
      notice={
        query.imported === "1"
          ? "imported"
          : query.updated === "1"
            ? "updated"
            : undefined
      }
    />
  );
}
