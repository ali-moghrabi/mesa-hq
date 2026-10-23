"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "../auth/session";
import { connectDb } from "../db";
import { Client } from "../models/client";
import { HealthCheck, Incident } from "../models/health";
import { todayIn } from "./list";
import {
  clientInputSchema,
  fieldErrors,
  firstBillingDate,
  nextBillingOnEdit,
  type ClientInput,
} from "./schema";

export type CreateClientState =
  | { message?: string; errors?: Record<string, string> }
  | undefined;

export type NotesState =
  | { ok?: boolean; message?: string; savedAt?: number }
  | undefined;

export type DeleteClientState =
  | { message?: string; deleted?: string }
  | undefined;

const cents = (amount: number) => Math.round(amount * 100);

const TAKEN = {
  message: "That site id is taken.",
  errors: { slug: "Another client already uses this id" },
};

function readForm(
  form: FormData,
): { ok: true; data: ClientInput } | { ok: false; state: CreateClientState } {
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return {
      ok: false,
      state: {
        message: "The form couldn't be read. Reload the page and try again.",
      },
    };
  }

  const withDefaults =
    raw && typeof raw === "object"
      ? { apiUrl: "", isDemo: false, ...raw }
      : raw;
  const parsed = clientInputSchema.safeParse(withDefaults);
  if (!parsed.success) {
    console.warn("[clients] form rejected:", fieldErrors(parsed.error));
    return {
      ok: false,
      state: {
        message: "Some details need your attention.",
        errors: fieldErrors(parsed.error),
      },
    };
  }
  return { ok: true, data: parsed.data };
}

function fields(v: ClientInput) {
  return {
    name: v.name,
    type: v.type,
    city: v.city,
    country: v.country,
    address: v.address,
    contact: {
      name: v.contactName,
      role: v.contactRole,
      phone: v.phone,
      whatsapp: v.whatsapp,
      email: v.email,
    },
    subscription: {
      plan: v.plan,
      cycle: v.cycle,
      currency: v.currency,
      monthlyPriceCents: cents(v.monthlyPrice),
      setupFeeCents: cents(v.setupFee),
      founding: v.founding,
      setupPaid: v.setupPaid,
      startDate: v.startDate,
      billingDay: v.billingDay,
      status: v.status,
      trialEndsAt: v.status === "trial" ? v.trialEndsAt : "",
      paymentMethod: v.paymentMethod,
      nextBillingDate: "",
    },
    website: {
      stage: v.stage,
      domain: v.domain,
      launchDate: v.launchDate,
      features: v.features,
      vercelProject: v.vercelProject,
      renderService: v.renderService,
      apiUrl: v.apiUrl,
    },
    notes: v.notes,
    isDemo: v.isDemo,
  };
}

async function keepOneDemo(v: ClientInput, slug: string) {
  if (v.isDemo)
    await Client.updateMany(
      { slug: { $ne: slug }, isDemo: true },
      { $set: { isDemo: false } },
    );
}

export async function createClient(
  _previous: CreateClientState,
  form: FormData,
): Promise<CreateClientState> {
  const me = await requireAdmin(["owner"]);
  const read = readForm(form);
  if (!read.ok) return read.state;
  const v = read.data;

  await connectDb();
  if (await Client.exists({ slug: v.slug })) return TAKEN;

  const doc = fields(v);
  doc.subscription.nextBillingDate =
    v.status === "active" || v.status === "trial" ? firstBillingDate(v) : "";

  try {
    await Client.create({ ...doc, slug: v.slug, createdBy: me.email });
    await keepOneDemo(v, v.slug);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return TAKEN;
    throw error;
  }

  redirect(`/clients?created=${encodeURIComponent(v.slug)}`);
}

export async function updateClient(
  slug: string,
  _previous: CreateClientState,
  form: FormData,
): Promise<CreateClientState> {
  await requireAdmin(["owner"]);
  const read = readForm(form);
  if (!read.ok) return read.state;
  const v = read.data;

  const doc = fields(v);
  doc.subscription.nextBillingDate = nextBillingOnEdit(v, todayIn());

  await connectDb();
  const result = await Client.updateOne(
    { slug },
    { $set: doc },
    { runValidators: true },
  );
  if (result.matchedCount === 0)
    return {
      message: "This client no longer exists. It may have been deleted.",
    };
  await keepOneDemo(v, slug);

  revalidatePath("/clients");
  revalidatePath(`/clients/${slug}`);
  redirect(`/clients/${encodeURIComponent(slug)}?saved=1`);
}

export async function deleteClient(
  _previous: DeleteClientState,
  form: FormData,
): Promise<DeleteClientState> {
  await requireAdmin(["owner"]);
  const slug = String(form.get("slug") ?? "");
  const confirm = String(form.get("confirm") ?? "")
    .trim()
    .toLowerCase();
  if (!slug || confirm !== slug)
    return { message: "Type the site id exactly to confirm." };

  await connectDb();

  const removed = await Client.findOneAndDelete(
    { slug, isDemo: { $ne: true } },
    { projection: { name: 1 } },
  ).lean();
  if (!removed)
    return {
      message: (await Client.exists({ slug, isDemo: true }))
        ? 'This is the MESA Demo. Untick "MESA Demo" in its edit form first.'
        : "This client was already deleted.",
    };

  await Promise.all([
    HealthCheck.deleteMany({ client: removed._id }),
    Incident.deleteMany({ client: removed._id }),
  ]);

  revalidatePath("/clients");
  const back = String(form.get("redirectTo") ?? "");
  if (back === "/clients")
    redirect(`/clients?deleted=${encodeURIComponent(removed.name)}`);
  return { deleted: removed.name };
}

export async function saveClientNotes(
  slug: string,
  _previous: NotesState,
  form: FormData,
): Promise<NotesState> {
  await requireAdmin(["owner"]);
  const notes = String(form.get("notes") ?? "").trim();
  if (notes.length > 2000)
    return { message: "Notes can be 2,000 characters at most." };

  await connectDb();
  const result = await Client.updateOne({ slug }, { $set: { notes } });
  if (result.matchedCount === 0)
    return { message: "This client no longer exists." };

  revalidatePath(`/clients/${slug}`);
  return { ok: true, savedAt: Date.now() };
}
