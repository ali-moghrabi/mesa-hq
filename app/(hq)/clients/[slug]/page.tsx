import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientDetailView } from "@/components/clients/ClientDetailView";
import { HealthCard } from "@/components/health/HealthCard";
import { requireAdmin } from "@/lib/auth/session";
import { todayIn } from "@/lib/clients/list";
import { getClient } from "@/lib/clients/queries";
import { getClientHealth } from "@/lib/health/queries";
import { SLOW_MS } from "@/lib/health/state";
import { BillingCard } from "@/components/billing/BillingCard";
import { clientPayments } from "@/lib/billing/queries";
import { stripeConfigured } from "@/lib/billing/stripe";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireAdmin();
  const client = await getClient((await params).slug);
  return { title: client?.name ?? "Client not found" };
}

export default async function ClientPage({ params, searchParams }: Props) {
  await requireAdmin();
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const client = await getClient(slug);
  if (!client) notFound();

  const [health, payments] = await Promise.all([
    getClientHealth(client.id, SLOW_MS),
    client.isDemo ? null : clientPayments(client.id),
  ]);
  const today = todayIn();

  return (
    <ClientDetailView
      client={client}
      today={today}
      saved={query.saved === "1"}
      billing={
        payments && (
          <BillingCard
            client={client}
            payments={payments.rows}
            totals={payments.totals}
            today={today}
            stripeReady={stripeConfigured()}
          />
        )
      }
      health={
        health && (
          <HealthCard
            slug={client.slug}
            live={client.stage === "live"}
            detail={health}
            today={today}
            now={health.now}
          />
        )
      }
    />
  );
}
