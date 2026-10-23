import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClientForm } from "@/components/clients/ClientForm";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New client" };

export default async function CreateClientPage() {
  await requireAdmin(["owner"]);

  return (
    <>
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Clients
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">New client</h1>
      <p className="mt-1.5 text-muted-foreground">
        The restaurant, who you deal with, and what they pay. You can change
        everything later.
      </p>
      <ClientForm />
    </>
  );
}
