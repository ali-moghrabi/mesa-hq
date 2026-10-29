"use server";

import { redirect } from "next/navigation";
import type { Types } from "mongoose";
import { z } from "zod";
import { connectDb } from "../db";
import { Admin } from "../models/admin";
import { logEvent, requestMeta, type RequestMeta } from "./audit";
import {
  beginMove,
  completeChallenge,
  endChallenge,
  finishMove,
  MfaError,
  readChallenge,
  renewRecoveryCodes,
  requireCurrentCode,
  startChallenge,
} from "./mfa";
import { safeNext } from "./next";
import {
  dummyHash,
  hashPassword,
  PASSWORD_MIN,
  verifyPassword,
} from "./password";
import { qrSvg } from "./qr";
import { clearFailures, recordFailure, waitMinutes } from "./rate-limit";
import { isRole, type Role } from "./roles";
import { endSession, requireAdmin, startSession } from "./session";

export type SignInState = { error?: string; email?: string } | undefined;
export type CodeState = { error?: string; restart?: boolean } | undefined;
export type SetupState =
  | {
      error?: string;
      restart?: boolean;
      recoveryCodes?: string[];
      account?: string;
      next?: string;
    }
  | undefined;

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
  next: z.string().max(500).optional(),
});

const PENDING_SIGN_IN = {
  challengeHash: 1,
  challengeExpiresAt: 1,
  challengeAttempts: 1,
} as const;

const tooMany = (wait: number) =>
  `Too many tries. Try again in ${wait} minute${wait === 1 ? "" : "s"}.`;

const readCode = (form: FormData) =>
  String(form.get("code") ?? "").slice(0, 40);

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
    return {
      error: "Enter your email and password.",
      email: raw.email.slice(0, 200),
    };
  const { email, password, next } = parsed.data;

  await connectDb();
  const meta = await requestMeta();
  const wait = await waitMinutes(email, meta.ip);
  if (wait > 0) return { error: tooMany(wait), email };

  const admin = await Admin.findOne({ email }).select("+passwordHash").lean();
  const matches = await verifyPassword(
    password,
    admin?.passwordHash ?? (await dummyHash()),
  );
  if (!admin || !matches || !admin.active || !isRole(admin.role)) {
    await recordFailure(email, meta.ip);
    const who = { adminId: admin?._id, email, name: admin?.name };
    await logEvent("sign-in-failed", who, meta);
    if ((await waitMinutes(email, meta.ip)) > 0)
      await logEvent("sign-in-locked", who, meta);
    return { error: "That email and password don't match.", email };
  }

  await clearFailures(email);
  const purpose = await startChallenge(admin);
  const target = safeNext(next);
  redirect(
    `/sign-in/${purpose}${target === "/" ? "" : `?next=${encodeURIComponent(target)}`}`,
  );
}

export async function verifyCode(
  _previous: CodeState,
  form: FormData,
): Promise<CodeState> {
  const meta = await requestMeta();
  const pending = await readChallenge();
  if (!pending)
    return {
      error: "That sign-in expired. Enter your password again.",
      restart: true,
    };
  if (pending.purpose !== "verify") redirect("/sign-in/setup");

  try {
    await completeChallenge(pending.admin, "verify", readCode(form), meta);
  } catch (error) {
    if (error instanceof MfaError)
      return { error: error.message, restart: error.restart };
    throw error;
  }
  await finishSignIn(pending.admin, meta);
  redirect(safeNext(form.get("next")));
}

export async function confirmSetup(
  _previous: SetupState,
  form: FormData,
): Promise<SetupState> {
  const meta = await requestMeta();
  const pending = await readChallenge();
  if (!pending)
    return {
      error: "That sign-in expired. Enter your password again.",
      restart: true,
    };
  if (pending.purpose !== "setup") redirect("/sign-in/verify");

  let recoveryCodes: string[] | undefined;
  try {
    ({ recoveryCodes } = await completeChallenge(
      pending.admin,
      "setup",
      readCode(form),
      meta,
    ));
  } catch (error) {
    if (error instanceof MfaError)
      return { error: error.message, restart: error.restart };
    throw error;
  }
  await finishSignIn(pending.admin, meta);
  return {
    recoveryCodes,
    account: pending.admin.email,
    next: safeNext(form.get("next")),
  };
}

export async function cancelSignIn() {
  const pending = await readChallenge();
  await endChallenge(pending?.admin._id);
  redirect("/sign-in");
}

async function finishSignIn(
  admin: {
    _id: Types.ObjectId;
    email: string;
    name?: string;
    role: string;
    tokenVersion: number;
  },
  meta: RequestMeta,
) {
  await endChallenge(admin._id);
  await Admin.updateOne(
    { _id: admin._id },
    { $set: { lastSignInAt: new Date() } },
  );
  await startSession({
    id: String(admin._id),
    role: admin.role as Role,
    tokenVersion: admin.tokenVersion ?? 0,
  });
  await logEvent(
    "sign-in",
    { adminId: admin._id, email: admin.email, name: admin.name },
    meta,
  );
}

export async function signOut() {
  await endSession();
  redirect("/sign-in");
}

export async function signOutEverywhere() {
  const session = await requireAdmin(["owner"]);
  await Admin.updateOne(
    { _id: session.id },
    { $inc: { tokenVersion: 1 }, $unset: PENDING_SIGN_IN },
  );
  await endChallenge();
  await logEvent("signed-out-everywhere", {
    adminId: session.id,
    email: session.email,
    name: session.name,
  });
  await endSession();
  redirect("/sign-in");
}

export type CodesState = { error?: string; codes?: string[] } | undefined;
export type MoveState =
  | {
      error?: string;
      step?: "scan" | "done";
      qr?: string;
      uri?: string;
      secret?: string;
      account?: string;
      codes?: string[];
    }
  | undefined;
export type PasswordState = { error?: string; done?: boolean } | undefined;

const failure = (error: unknown) => {
  if (error instanceof MfaError) return error.message;
  throw error;
};

export async function renewBackupCodes(
  _previous: CodesState,
  form: FormData,
): Promise<CodesState> {
  const session = await requireAdmin(["owner"]);
  try {
    return {
      codes: await renewRecoveryCodes(
        session.id,
        readCode(form),
        await requestMeta(),
      ),
    };
  } catch (error) {
    return { error: failure(error) };
  }
}

export async function moveToNewPhone(
  previous: MoveState,
  form: FormData,
): Promise<MoveState> {
  const session = await requireAdmin(["owner"]);
  const meta = await requestMeta();
  const step = form.get("step") === "confirm" ? "confirm" : "start";
  try {
    if (step === "start") {
      const info = await beginMove(session.id, readCode(form), meta);
      return {
        step: "scan",
        qr: qrSvg(info.uri),
        uri: info.uri,
        secret: info.secret,
        account: info.account,
      };
    }
    return {
      step: "done",
      codes: await finishMove(session.id, readCode(form), meta),
      account: session.email,
    };
  } catch (error) {
    // stay on the QR step when the new phone's code was wrong
    return {
      ...(step === "confirm" ? previous : undefined),
      error: failure(error),
    };
  }
}

const passwordSchema = z
  .object({
    current: z.string().min(1).max(200),
    password: z
      .string()
      .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
      .max(200, "That's too long."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "The two new passwords don't match.",
  })
  .refine((v) => v.password !== v.current, {
    message: "Choose a password you haven't used here.",
  });

export async function changePassword(
  _previous: PasswordState,
  form: FormData,
): Promise<PasswordState> {
  const session = await requireAdmin(["owner"]);
  const parsed = passwordSchema.safeParse({
    current: String(form.get("current") ?? ""),
    password: String(form.get("password") ?? ""),
    confirm: String(form.get("confirm") ?? ""),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const meta = await requestMeta();
  const wait = await waitMinutes(session.email, meta.ip);
  if (wait > 0) return { error: tooMany(wait) };

  const admin = await Admin.findById(session.id).select("+passwordHash").lean();
  if (
    !admin ||
    !(await verifyPassword(parsed.data.current, admin.passwordHash))
  ) {
    await recordFailure(session.email, meta.ip);
    return { error: "Your current password isn't right." };
  }

  try {
    await requireCurrentCode(session.id, readCode(form), meta);
  } catch (error) {
    return { error: failure(error) };
  }

  const updated = await Admin.findOneAndUpdate(
    { _id: session.id },
    {
      $set: { passwordHash: await hashPassword(parsed.data.password) },
      $inc: { tokenVersion: 1 },
      $unset: PENDING_SIGN_IN,
    },
    { returnDocument: "after", projection: { role: 1, tokenVersion: 1 } },
  ).lean();
  if (!updated) return { error: "Sign in again." };
  await clearFailures(session.email);
  await startSession({
    id: session.id,
    role: updated.role,
    tokenVersion: updated.tokenVersion,
  });
  await logEvent(
    "password-changed",
    { adminId: session.id, email: session.email, name: session.name },
    meta,
  );
  return { done: true };
}
