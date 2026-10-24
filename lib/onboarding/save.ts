import "server-only";
import { connectDb } from "../db";
import { OnboardingRequest } from "../models/onboarding";
import type { OnboardingPayload } from "./schema";

export async function saveSubmission(
  payload: OnboardingPayload,
  source: "webhook" | "import",
): Promise<{ id: string; created: boolean }> {
  await connectDb();
  const submittedAt = payload.submittedAt
    ? new Date(payload.submittedAt)
    : new Date();

  const result = await OnboardingRequest.findOneAndUpdate(
    { ref: payload.id },
    {
      $set: {
        answers: payload.answers,
        config: payload.config,
        ...(payload.files.length && { files: payload.files }),
      },
      $setOnInsert: {
        status: "new",
        source,
        submittedAt,
        readAt: null,
        notes: "",
        clientSlug: "",
        convertedAt: null,
        ...(!payload.files.length && { files: [] }),
      },
    },
    { upsert: true, new: true, includeResultMetadata: true },
  );

  return {
    id: String(result.value?._id ?? ""),
    created: !result.lastErrorObject?.updatedExisting,
  };
}
