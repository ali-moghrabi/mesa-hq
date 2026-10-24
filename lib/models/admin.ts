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
  },
  { timestamps: true, collection: "admins" },
);

export const Admin: Model<AdminDoc> = registerModel("Admin", adminSchema);
