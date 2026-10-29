import type { Model, Types } from "mongoose";
import { ROLES, type Role } from "../auth/roles";
import { defineSchema, registerModel } from "./register";

export interface AdminDoc {
  _id: Types.ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  tokenVersion: number;
  lastSignInAt?: Date;
  mfaEnabled: boolean;
  mfaEnabledAt?: Date;
  mfaSecret?: string;
  mfaLastStep?: number;
  mfaRecoveryCodes?: string[];
  mfaFailures?: number;
  mfaLockedUntil?: Date;
  challengeHash?: string;
  challengePurpose?: "verify" | "setup";
  challengeExpiresAt?: Date;
  challengeAttempts?: number;
  challengeSecret?: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = defineSchema<AdminDoc>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, default: "", trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "owner", required: true },
    active: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    lastSignInAt: { type: Date },
    mfaEnabled: { type: Boolean, default: false },
    mfaEnabledAt: { type: Date },
    mfaSecret: { type: String, select: false },
    mfaLastStep: { type: Number, select: false },
    mfaRecoveryCodes: { type: [String], select: false, default: undefined },
    mfaFailures: { type: Number, select: false },
    mfaLockedUntil: { type: Date, select: false },
    challengeHash: { type: String, select: false },
    challengePurpose: {
      type: String,
      enum: ["verify", "setup"],
      select: false,
    },
    challengeExpiresAt: { type: Date, select: false },
    challengeAttempts: { type: Number, select: false },
    challengeSecret: { type: String, select: false },
  },
  { timestamps: true, collection: "admins" },
);

export const Admin: Model<AdminDoc> = registerModel("Admin", adminSchema);
