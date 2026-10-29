import { Schema, type Model, type Types } from "mongoose";
import { defineSchema, registerModel } from "./register";

export const SECURITY_EVENTS = [
  "sign-in",
  "sign-in-failed",
  "sign-in-locked",
  "code-failed",
  "codes-locked",
  "backup-code-used",
  "mfa-enabled",
  "mfa-moved",
  "codes-renewed",
  "password-changed",
  "signed-out-everywhere",
  "mfa-reset",
] as const;
export type SecurityEventType = (typeof SECURITY_EVENTS)[number];

export interface SecurityEventDoc {
  _id: Types.ObjectId;
  type: SecurityEventType;
  adminId?: Types.ObjectId;
  email?: string;
  ip?: string;
  userAgent?: string;
  at: Date;
}

const securityEventSchema = defineSchema<SecurityEventDoc>(
  {
    type: { type: String, enum: SECURITY_EVENTS, required: true },
    adminId: { type: Schema.Types.ObjectId, ref: "Admin" },
    email: { type: String, maxlength: 200 },
    ip: { type: String, maxlength: 64 },
    userAgent: { type: String, maxlength: 300 },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "security_events", versionKey: false },
);
securityEventSchema.index({ at: -1 });
securityEventSchema.index(
  { at: 1 },
  { expireAfterSeconds: 180 * 24 * 60 * 60 },
);

export const SecurityEvent: Model<SecurityEventDoc> = registerModel(
  "SecurityEvent",
  securityEventSchema,
);
