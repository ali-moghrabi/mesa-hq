import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { registerModel } from "./register";

export const HEALTH_TARGETS = ["website", "api"] as const;
export type HealthTarget = (typeof HEALTH_TARGETS)[number];

const CHECK_DAYS = 30;

const healthCheckSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    target: { type: String, enum: HEALTH_TARGETS, required: true },
    ok: { type: Boolean, required: true },
    status: { type: Number, default: 0 },
    ms: { type: Number, default: 0 },
    error: { type: String, default: "" },
    at: { type: Date, default: () => new Date() },
  },
  { collection: "health_checks", versionKey: false },
);
healthCheckSchema.index({ client: 1, target: 1, at: -1 });
healthCheckSchema.index(
  { at: 1 },
  { expireAfterSeconds: CHECK_DAYS * 24 * 60 * 60 },
);

const incidentSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    target: { type: String, enum: HEALTH_TARGETS, required: true },
    cause: { type: String, default: "" },
    startedAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
  },
  { collection: "health_incidents", versionKey: false },
);
incidentSchema.index({ client: 1, startedAt: -1 });
incidentSchema.index({ resolvedAt: 1 });

export type HealthCheckDoc = InferSchemaType<typeof healthCheckSchema>;
export type IncidentDoc = InferSchemaType<typeof incidentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const HealthCheck: Model<HealthCheckDoc> = registerModel<HealthCheckDoc>(
  "HealthCheck",
  healthCheckSchema,
);

export const Incident: Model<IncidentDoc> = registerModel<IncidentDoc>(
  "Incident",
  incidentSchema,
);
