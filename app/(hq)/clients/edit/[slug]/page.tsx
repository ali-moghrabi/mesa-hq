import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ClientForm } from "@/components/clients/ClientForm";
import { DeleteClientButton } from "@/components/clients/DeleteClientButton";
import { requireAdmin } from "@/lib/auth/session";
import { getClientForEdit } from "@/lib/clients/queries";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireAdmin(["owner"]);
  const client = await getClientForEdit((await params).slug);
  return { title: client ? `Edit ${client.name}` : "Client not found" };
}

export default async function EditClientPage({ params }: Props) {
  await requireAdmin(["owner"]);
  const client = await getClientForEdit((await params).slug);
  if (!client) notFound();

  return (
    <>
      <Link
        href={`/clients/${client.slug}`}
        className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4 shrink-0" /> Client page
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-semibold tracking-tight">
            {client.name}
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            Edit the details, plan or billing.{" "}
            <span className="font-mono text-sm">sites/{client.slug}</span>
          </p>
        </div>
        <DeleteClientButton
          name={client.name}
          slug={client.slug}
          variant="full"
          redirectTo="/clients"
        />
      </div>
      <ClientForm key={client.slug} client={client} />
    </>
  );
}
