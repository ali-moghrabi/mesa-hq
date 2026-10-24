"use server";

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "../auth/session";
import { connectDb } from "../db";
import { OnboardingRequest } from "../models/onboarding";
import { saveSubmission } from "./save";
import { onboardingAnswersSchema, type RequestStatus } from "./schema";

const refresh = (id?: string) => {
  revalidatePath("/onboarding");
  if (id) revalidatePath(`/onboarding/${id}`);
  revalidatePath("/", "layout");
};

const MANUAL: RequestStatus[] = ["new", "reviewing", "declined", "archived"];

export async function setRequestStatus(
  id: string,
  status: RequestStatus,
): Promise<void> {
  await requireAdmin(["owner"]);
  if (!isValidObjectId(id) || !MANUAL.includes(status)) return;
  await connectDb();
  await OnboardingRequest.updateOne({ _id: id }, { $set: { status } });
  refresh(id);
}

export type RequestNotesState =
  | { ok?: boolean; message?: string; savedAt?: number }
  | undefined;

export async function saveRequestNotes(
  id: string,
  _previous: RequestNotesState,
  form: FormData,
): Promise<RequestNotesState> {
  await requireAdmin(["owner"]);
  const notes = String(form.get("notes") ?? "").trim();
  if (notes.length > 2000)
    return { message: "Notes can be 2,000 characters at most." };
  if (!isValidObjectId(id)) return { message: "This request doesn't exist." };
  await connectDb();
  const result = await OnboardingRequest.updateOne(
    { _id: id },
    { $set: { notes } },
  );
  if (result.matchedCount === 0)
    return { message: "This request no longer exists." };
  revalidatePath(`/onboarding/${id}`);
  return { ok: true, savedAt: Date.now() };
}

export async function deleteRequest(id: string): Promise<void> {
  await requireAdmin(["owner"]);
  if (!isValidObjectId(id)) return;
  await connectDb();
  const removed = await OnboardingRequest.findByIdAndDelete(id, {
    projection: { "answers.restaurant.name": 1 },
  }).lean<{ answers?: { restaurant?: { name?: string } } }>();
  refresh();
  redirect(
    `/onboarding?deleted=${encodeURIComponent(removed?.answers?.restaurant?.name ?? "The request")}`,
  );
}

export type ImportState = { message?: string } | undefined;

const refFromName = (name: string) => {
  const match = name.match(/^(.+?)-(answers|config)\.json$/i);
  return match && /^[a-z0-9-]{3,120}$/i.test(match[1]) ? match[1] : "";
};

async function readText(value: FormDataEntryValue | null): Promise<string> {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.size > 1_000_000) throw new Error("too large");
  return value.text();
}

export async function importRequest(
  _previous: ImportState,
  form: FormData,
): Promise<ImportState> {
  await requireAdmin(["owner"]);

  const answersFile = form.get("answers");
  const configFile = form.get("config");
  let answersText = "";
  let configText = "";
  try {
    answersText = (await readText(answersFile)).trim();
    configText = (await readText(configFile)).trim();
  } catch {
    return { message: "Those files are too large to be onboarding files." };
  }
  if (!answersText)
    return { message: "Choose the …-answers.json file from the email." };

  let raw: unknown;
  try {
    raw = JSON.parse(answersText);
  } catch {
    return {
      message: "The answers file isn't valid JSON. Is it the right file?",
    };
  }
  const parsed = onboardingAnswersSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      message: `That doesn't look like onboarding answers (${issue.path.join(" › ") || "file"}: ${issue.message}).`,
    };
  }

  let config = "{}";
  if (configText) {
    try {
      config = JSON.stringify(JSON.parse(configText), null, 2);
    } catch {
      return {
        message: "The config file isn't valid JSON. Is it the right file?",
      };
    }
  }

  const name = (v: FormDataEntryValue | null) =>
    v && typeof v !== "string" ? v.name : "";
  const ref =
    refFromName(name(answersFile)) ||
    refFromName(name(configFile)) ||
    `${
      parsed.data.restaurant.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "restaurant"
    }-${new Date().toISOString().slice(0, 10)}-import`;

  const saved = await saveSubmission(
    { id: ref, answers: parsed.data, config, files: [] },
    "import",
  );
  refresh(saved.id);
  redirect(
    `/onboarding/${saved.id}${saved.created ? "?imported=1" : "?updated=1"}`,
  );
}
