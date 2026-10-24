import { Schema, type Model, type Types } from "mongoose";
import { defineSchema, registerModel } from "./register";

/**
 * Health monitoring: every check's result (kept 30 days), and incidents (a target that went down,
 * from the moment it was confirmed down until it answered again).
 */

export const HEALTH_TARGETS = ["website", "api"] as const;
export type HealthTarget = (typeof HEALTH_TARGETS)[number];

const CHECK_DAYS = 30;

export interface HealthCheckDoc {
  client: Types.ObjectId;
  target: HealthTarget;
  ok: boolean;
  /** HTTP status, 0 when nothing answered */
  status: number;
  /** Response time in milliseconds */
  ms: number;
  error: string;
  at: Date;
}

export interface IncidentDoc {
  _id: Types.ObjectId;
  client: Types.ObjectId;
  target: HealthTarget;
  /** Why it was down, from the check that confirmed it (e.g. "No answer within 10s") */
  cause: string;
  startedAt: Date;
  resolvedAt: Date | null;
}

const healthCheckSchema = defineSchema<HealthCheckDoc>(
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
// Mongo deletes checks by itself once they are 30 days old
healthCheckSchema.index(
  { at: 1 },
  { expireAfterSeconds: CHECK_DAYS * 24 * 60 * 60 },
);

const incidentSchema = defineSchema<IncidentDoc>(
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

export const HealthCheck: Model<HealthCheckDoc> = registerModel(
  "HealthCheck",
  healthCheckSchema,
);

export const Incident: Model<IncidentDoc> = registerModel(
  "Incident",
  incidentSchema,
);
