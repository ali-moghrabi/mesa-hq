"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { connectDb } from "../db";
import { Admin } from "../models/admin";
import { dummyHash, verifyPassword } from "./password";
import { clearFailures, recordFailure, waitMinutes } from "./rate-limit";
import { isRole } from "./roles";
import { endSession, requireAdmin, startSession } from "./session";

export type SignInState = { error?: string; email?: string } | undefined;

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
  next: z.string().max(500).optional(),
});

function safeNext(next: string | undefined): string {
  return next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\") &&
    next !== "/sign-in"
    ? next
    : "/";
}

function clientIp(h: Headers): string {
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function signIn(
  _previous: SignInState,
  form: FormData,
): Promise<SignInState> {
  const raw = {
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    next: String(form.get("next") ?? "") || undefined,
  };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success)
    return { error: "Enter your email and password.", email: raw.email };
  const { email, password, next } = parsed.data;

  await connectDb();
  const ip = clientIp(await headers());
  const wait = await waitMinutes(email, ip);
  if (wait > 0)
    return {
      error: `Too many tries. Try again in ${wait} minute${wait === 1 ? "" : "s"}.`,
      email,
    };

  const admin = await Admin.findOne({ email }).select("+passwordHash").lean();
  const matches = await verifyPassword(
    password,
    admin?.passwordHash ?? (await dummyHash()),
  );
  if (!admin || !matches || !admin.active || !isRole(admin.role)) {
    await recordFailure(email, ip);
    return { error: "That email and password don't match.", email };
  }

  await clearFailures(email);
  await Admin.updateOne(
    { _id: admin._id },
    { $set: { lastSignInAt: new Date() } },
  );
  await startSession({
    id: String(admin._id),
    role: admin.role,
    tokenVersion: admin.tokenVersion ?? 0,
  });
  redirect(safeNext(next));
}

export async function signOut() {
  await endSession();
  redirect("/sign-in");
}

export async function signOutEverywhere() {
  const session = await requireAdmin();
  await Admin.updateOne({ _id: session.id }, { $inc: { tokenVersion: 1 } });
  await endSession();
  redirect("/sign-in");
}
