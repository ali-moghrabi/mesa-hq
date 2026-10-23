import type { Metadata } from "next";
import { ClientsView } from "@/components/clients/ClientsView";
import { requireAdmin } from "@/lib/auth/session";
import { parseFilters } from "@/lib/clients/list";
import { listClients } from "@/lib/clients/queries";
import { connectDb } from "@/lib/db";
import { Client } from "@/lib/models/client";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const filters = parseFilters(params);

  const one = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
  };
  const created = one("created");
  const updated = one("updated");
  const deleted = one("deleted")?.slice(0, 80);
  const shownSlug = created ?? updated;

  await connectDb();
  const [data, shown] = await Promise.all([
    listClients(filters),
    shownSlug ? Client.findOne({ slug: shownSlug }, { name: 1 }).lean() : null,
  ]);

  const notice = shown
    ? {
        kind: created ? ("created" as const) : ("updated" as const),
        name: shown.name,
      }
    : deleted
      ? { kind: "deleted" as const, name: deleted }
      : undefined;

  return <ClientsView {...data} filters={filters} notice={notice} />;
}
