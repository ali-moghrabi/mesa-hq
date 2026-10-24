import type { Model } from "mongoose";
import { defineSchema, registerModel } from "./register";

export type LoginAttemptDoc = { key: string; at: Date };

const loginAttemptSchema = defineSchema<LoginAttemptDoc>(
  {
    key: { type: String, required: true },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "login_attempts", versionKey: false },
);
loginAttemptSchema.index({ key: 1, at: -1 });
loginAttemptSchema.index({ at: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const LoginAttempt: Model<LoginAttemptDoc> = registerModel(
  "LoginAttempt",
  loginAttemptSchema,
);
