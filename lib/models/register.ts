import mongoose, { Schema, type Model, type SchemaDefinition } from "mongoose";

export function defineSchema<T>(
  definition: Record<string, unknown>,
  options?: Record<string, unknown>,
): Schema<T> {
  return new Schema<T>(
    definition as unknown as SchemaDefinition<T>,
    options as never,
  );
}

export function registerModel<T>(name: string, schema: Schema<T>): Model<T> {
  const existing = mongoose.models[name] as Model<T> | undefined;
  if (existing) {
    if (process.env.NODE_ENV === "production" || existing.schema === schema)
      return existing;
    mongoose.deleteModel(name);
  }
  return mongoose.model<T>(name, schema);
}
