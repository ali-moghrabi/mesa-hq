import mongoose from "mongoose";

const cache = globalThis as unknown as { __hqMongo?: Promise<typeof mongoose> };

export function connectDb(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  const connection =
    cache.__hqMongo ??
    mongoose
      .connect(uri, { serverSelectionTimeoutMS: 10_000 })
      .catch((error: unknown) => {
        cache.__hqMongo = undefined;
        throw error;
      });
  cache.__hqMongo = connection;
  return connection;
}
