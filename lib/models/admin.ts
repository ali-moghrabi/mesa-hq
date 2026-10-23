import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "./register";
import { ROLES } from "../auth/roles";

const adminSchema = new Schema(
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

export type AdminDoc = InferSchemaType<typeof adminSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Admin: Model<AdminDoc> = registerModel<AdminDoc>(
  "Admin",
  adminSchema,
);
