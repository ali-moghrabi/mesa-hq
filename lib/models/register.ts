import mongoose, { type Model, type Schema } from "mongoose";

export function registerModel<T>(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: Schema<any>,
): Model<T> {
  const existing = mongoose.models[name] as Model<T> | undefined;
  if (existing) {
    if (process.env.NODE_ENV === "production" || existing.schema === schema)
      return existing;
    mongoose.deleteModel(name);
  }
  return mongoose.model<T>(name, schema);
}
