import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import { ClientForm } from "@/components/clients/ClientForm";
import { requireAdmin } from "@/lib/auth/session";
import { clientPrefill } from "@/lib/onboarding/labels";
import { getRequestForConvert } from "@/lib/onboarding/queries";

export const metadata: Metadata = { title: "New client" };

export default async function CreateClientPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin(["owner"]);

  const from = (await searchParams).from;
  const request =
    typeof from === "string" ? await getRequestForConvert(from) : null;
  const prefill = request
    ? {
        requestId: String(request._id),
        values: clientPrefill(request.answers, request.ref),
      }
    : undefined;

  return (
    <>
      <Link
        href={prefill ? `/onboarding/${prefill.requestId}` : "/clients"}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {prefill ? "The request" : "Clients"}
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">New client</h1>
      <p className="mt-1.5 text-muted-foreground">
        The restaurant, who you deal with, and what they pay. You can change
        everything later.
      </p>
      {prefill && (
        <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          <Inbox className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            Filled from{" "}
            <strong className="font-semibold">
              {request!.answers.restaurant.name}
            </strong>
            &apos;s onboarding request: check the plan, price and dates, then
            create. The request will be marked as converted.
            {request!.clientSlug && (
              <span className="mt-1 block text-accent">
                It was already converted once (to “{request!.clientSlug}”).
              </span>
            )}
          </span>
        </p>
      )}
      <ClientForm prefill={prefill} />
    </>
  );
}
