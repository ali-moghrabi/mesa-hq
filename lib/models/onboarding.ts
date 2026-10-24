import type { Model, Types } from "mongoose";
import type {
  OnboardingAnswers,
  OnboardingFile,
  RequestStatus,
} from "../onboarding/schema";
import { REQUEST_STATUS_IDS } from "../onboarding/schema";
import { defineSchema, registerModel } from "./register";

export interface OnboardingRequestDoc {
  _id: Types.ObjectId;
  ref: string;
  status: RequestStatus;
  source: "webhook" | "import";
  answers: OnboardingAnswers;
  config: string;
  files: OnboardingFile[];
  submittedAt: Date;
  readAt: Date | null;
  notes: string;
  clientSlug: string;
  convertedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const fileSchema = defineSchema<OnboardingFile>(
  {
    kind: { type: String, enum: ["logo", "photo", "menu"], required: true },
    name: { type: String, required: true },
    url: { type: String },
    bytes: { type: Number, default: 0 },
  },
  { _id: false },
);

const onboardingSchema = defineSchema<OnboardingRequestDoc>(
  {
    ref: { type: String, required: true, unique: true, trim: true },
    status: {
      type: String,
      enum: REQUEST_STATUS_IDS,
      default: "new",
      index: true,
    },
    source: { type: String, enum: ["webhook", "import"], default: "webhook" },
    answers: { type: Object, required: true },
    config: { type: String, default: "{}" },
    files: { type: [fileSchema], default: [] },
    submittedAt: { type: Date, required: true, index: true },
    readAt: { type: Date, default: null },
    notes: { type: String, default: "" },
    clientSlug: { type: String, default: "" },
    convertedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "onboarding_requests", minimize: false },
);

export const OnboardingRequest: Model<OnboardingRequestDoc> = registerModel(
  "OnboardingRequest",
  onboardingSchema,
);
