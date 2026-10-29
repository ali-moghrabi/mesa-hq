import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { isValidObjectId, type Types } from "mongoose";
import { connectDb } from "../db";
import { Admin } from "../models/admin";
import { logEvent, type RequestMeta } from "./audit";
import { seal, unseal } from "./secret-box";
import { cleanTotp, newTotpSecret, otpauthUri, verifyTotp } from "./totp";
import { secureCookies } from "./token";

export const CHALLENGE_COOKIE = secureCookies() ? "__Host-hq_mfa" : "hq_mfa";
const CHALLENGE_MS = 10 * 60_000;
const CHALLENGE_TRIES = 5;
const MAX_FAILURES = 10;
const LOCK_MS = 15 * 60_000;
const RECOVERY_COUNT = 10;
const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const ISSUER = "MESA HQ";

export type Purpose = "verify" | "setup";
export type SetupInfo = { secret: string; uri: string; account: string };

type Row = {
  _id: Types.ObjectId;
  email: string;
  name?: string;
  role: string;
  active: boolean;
  tokenVersion: number;
  mfaEnabled?: boolean;
  mfaSecret?: string;
  mfaLastStep?: number;
  mfaRecoveryCodes?: string[];
  mfaFailures?: number;
  mfaLockedUntil?: Date;
  challengeHash?: string;
  challengePurpose?: Purpose;
  challengeExpiresAt?: Date;
  challengeAttempts?: number;
  challengeSecret?: string;
};

const FIELDS =
  "email name role active tokenVersion mfaEnabled +mfaSecret +mfaLastStep +mfaRecoveryCodes +mfaFailures +mfaLockedUntil +challengeHash +challengePurpose +challengeExpiresAt +challengeAttempts +challengeSecret";

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const normalizeRecovery = (c: string) =>
  c.toLowerCase().replace(/[^a-z0-9]/g, "");
const hashRecovery = (c: string) => sha256(normalizeRecovery(c));

export class MfaError extends Error {
  constructor(
    message: string,
    readonly restart = false,
  ) {
    super(message);
  }
}

export async function startChallenge(admin: {
  _id: Types.ObjectId;
  mfaEnabled?: boolean;
}): Promise<Purpose> {
  const purpose: Purpose = admin.mfaEnabled ? "verify" : "setup";
  const token = randomBytes(32).toString("base64url");
  await Admin.updateOne(
    { _id: admin._id },
    {
      $set: {
        challengeHash: sha256(token),
        challengePurpose: purpose,
        challengeExpiresAt: new Date(Date.now() + CHALLENGE_MS),
        challengeAttempts: 0,
      },
      $unset: { challengeSecret: 1 },
    },
  );
  (await cookies()).set(CHALLENGE_COOKIE, `${String(admin._id)}.${token}`, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "strict",
    path: "/",
    maxAge: CHALLENGE_MS / 1000,
  });
  return purpose;
}

export async function readChallenge(): Promise<{
  admin: Row;
  purpose: Purpose;
} | null> {
  const raw = (await cookies()).get(CHALLENGE_COOKIE)?.value ?? "";
  const [id, token] = raw.split(".");
  if (!id || !token || !isValidObjectId(id)) return null;
  await connectDb();
  const admin = await Admin.findById(id).select(FIELDS).lean<Row>();
  if (
    !admin ||
    !admin.active ||
    !admin.challengeHash ||
    admin.challengeHash !== sha256(token) ||
    !admin.challengeExpiresAt ||
    admin.challengeExpiresAt.getTime() < Date.now() ||
    (admin.challengeAttempts ?? 0) >= CHALLENGE_TRIES
  )
    return null;
  return { admin, purpose: admin.mfaEnabled ? "verify" : "setup" };
}

export async function endChallenge(adminId?: Types.ObjectId) {
  (await cookies()).delete({
    name: CHALLENGE_COOKIE,
    path: "/",
    secure: secureCookies(),
  });
  if (adminId)
    await Admin.updateOne(
      { _id: adminId },
      {
        $unset: {
          challengeHash: 1,
          challengePurpose: 1,
          challengeExpiresAt: 1,
          challengeAttempts: 1,
          challengeSecret: 1,
        },
      },
    );
}

export async function challengeSetupInfo(admin: Row): Promise<SetupInfo> {
  if (!admin.challengeSecret) {
    await Admin.updateOne(
      {
        _id: admin._id,
        challengeHash: admin.challengeHash,
        challengeSecret: { $exists: false },
      },
      { $set: { challengeSecret: seal(newTotpSecret()) } },
    );
    const fresh = await Admin.findById(admin._id)
      .select("+challengeSecret")
      .lean<{ challengeSecret?: string }>();
    if (!fresh?.challengeSecret) throw new MfaError("Sign in again.", true);
    admin.challengeSecret = fresh.challengeSecret;
  }
  return setupInfo(unseal(admin.challengeSecret), admin.email);
}

export async function completeChallenge(
  admin: Row,
  purpose: Purpose,
  code: string,
  meta: RequestMeta,
): Promise<{ recoveryCodes?: string[]; usedBackup: boolean }> {
  assertNotLocked(admin);

  const counted = await Admin.findOneAndUpdate(
    {
      _id: admin._id,
      challengeHash: admin.challengeHash,
      challengeAttempts: { $lt: CHALLENGE_TRIES },
    },
    { $inc: { challengeAttempts: 1 } },
    { returnDocument: "after", projection: { challengeAttempts: 1 } },
  ).lean<{ challengeAttempts?: number }>();
  if (!counted) {
    await endChallenge(admin._id);
    throw new MfaError("Too many wrong codes. Sign in again.", true);
  }
  const left = CHALLENGE_TRIES - (counted.challengeAttempts ?? CHALLENGE_TRIES);

  if (purpose === "setup") {
    if (admin.mfaEnabled || !admin.challengeSecret)
      throw new MfaError("Scan the QR code first.", true);
    const secret = unseal(admin.challengeSecret);
    const step = verifyTotp(secret, code);
    if (step === null) await wrongCode(admin, meta, left);
    const recoveryCodes = await turnOn(admin._id, secret, step!);
    await logEvent("mfa-enabled", who(admin), meta);
    return { recoveryCodes, usedBackup: false };
  }

  const used = await spendCode(admin, code);
  if (!used) await wrongCode(admin, meta, left);
  if (used === "backup") await logEvent("backup-code-used", who(admin), meta);
  return { usedBackup: used === "backup" };
}

export async function securityState(adminId: string) {
  await connectDb();
  const admin = await Admin.findById(adminId)
    .select("mfaEnabled mfaEnabledAt +mfaRecoveryCodes")
    .lean<{
      mfaEnabled?: boolean;
      mfaEnabledAt?: Date;
      mfaRecoveryCodes?: string[];
    }>();
  return {
    enabled: admin?.mfaEnabled === true,
    enabledAt: admin?.mfaEnabledAt?.toISOString(),
    recoveryCodesLeft: admin?.mfaRecoveryCodes?.length ?? 0,
  };
}

export async function requireCurrentCode(
  adminId: string,
  code: string,
  meta: RequestMeta,
) {
  await requireCode(await load(adminId), code, meta);
}

export async function renewRecoveryCodes(
  adminId: string,
  code: string,
  meta: RequestMeta,
): Promise<string[]> {
  const admin = await load(adminId);
  await requireCode(admin, code, meta);
  const codes = newRecoveryCodes();
  await Admin.updateOne(
    { _id: admin._id },
    { $set: { mfaRecoveryCodes: codes.map(hashRecovery) } },
  );
  await logEvent("codes-renewed", who(admin), meta);
  return codes;
}

export async function beginMove(
  adminId: string,
  code: string,
  meta: RequestMeta,
): Promise<SetupInfo> {
  const admin = await load(adminId);
  await requireCode(admin, code, meta);
  const secret = newTotpSecret();
  await Admin.updateOne(
    { _id: admin._id },
    {
      $set: {
        challengeSecret: seal(secret),
        challengePurpose: "setup",
        challengeExpiresAt: new Date(Date.now() + CHALLENGE_MS),
      },
    },
  );
  return setupInfo(secret, admin.email);
}

export async function finishMove(
  adminId: string,
  code: string,
  meta: RequestMeta,
): Promise<string[]> {
  const admin = await load(adminId);
  assertNotLocked(admin);
  if (
    !admin.challengeSecret ||
    admin.challengePurpose !== "setup" ||
    !admin.challengeExpiresAt ||
    admin.challengeExpiresAt.getTime() < Date.now()
  )
    throw new MfaError("That took too long. Start again.");
  const secret = unseal(admin.challengeSecret);
  const step = verifyTotp(secret, code);
  if (step === null) {
    await recordFailure(admin, meta);
    throw new MfaError(
      "That code isn't right. Check the app shows “MESA HQ”, then use the newest code.",
    );
  }
  const codes = await turnOn(admin._id, secret, step);
  await logEvent("mfa-moved", who(admin), meta);
  return codes;
}

async function load(adminId: string): Promise<Row> {
  await connectDb();
  const admin = isValidObjectId(adminId)
    ? await Admin.findById(adminId).select(FIELDS).lean<Row>()
    : null;
  if (!admin || !admin.active) throw new MfaError("Sign in again.", true);
  return admin;
}

const who = (a: Row) => ({ adminId: a._id, email: a.email, name: a.name });

function setupInfo(secret: string, email: string): SetupInfo {
  return {
    secret: secret.replace(/(.{4})/g, "$1 ").trim(),
    uri: otpauthUri(secret, ISSUER, email),
    account: email,
  };
}

function newRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_COUNT }, () => {
    let c = "";
    for (let i = 0; i < 10; i++)
      c += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    return `${c.slice(0, 5)}-${c.slice(5)}`;
  });
}

async function turnOn(
  adminId: Types.ObjectId,
  secret: string,
  step: number,
): Promise<string[]> {
  const codes = newRecoveryCodes();
  await Admin.updateOne(
    { _id: adminId },
    {
      $set: {
        mfaEnabled: true,
        mfaEnabledAt: new Date(),
        mfaSecret: seal(secret),
        mfaLastStep: step,
        mfaRecoveryCodes: codes.map(hashRecovery),
      },
      $unset: {
        mfaFailures: 1,
        mfaLockedUntil: 1,
        challengeSecret: 1,
        challengePurpose: 1,
        challengeExpiresAt: 1,
        challengeHash: 1,
        challengeAttempts: 1,
      },
    },
  );
  return codes;
}

async function spendCode(
  admin: Row,
  input: string,
): Promise<"app" | "backup" | null> {
  if (!admin.mfaEnabled || !admin.mfaSecret) return null;
  if (cleanTotp(input)) {
    const step = verifyTotp(
      unseal(admin.mfaSecret),
      input,
      admin.mfaLastStep ?? -1,
    );
    if (step === null) return null;
    const saved = await Admin.updateOne(
      {
        _id: admin._id,
        $or: [
          { mfaLastStep: { $lt: step } },
          { mfaLastStep: { $exists: false } },
        ],
      },
      { $set: { mfaLastStep: step }, $unset: { mfaFailures: 1 } },
    );
    return saved.modifiedCount === 1 ? "app" : null;
  }
  if (!normalizeRecovery(input)) return null;
  const hash = hashRecovery(input);
  const used = await Admin.updateOne(
    { _id: admin._id, mfaRecoveryCodes: hash },
    { $pull: { mfaRecoveryCodes: hash }, $unset: { mfaFailures: 1 } },
  );
  return used.modifiedCount === 1 ? "backup" : null;
}

async function requireCode(admin: Row, code: string, meta: RequestMeta) {
  assertNotLocked(admin);
  if (!(await spendCode(admin, code))) {
    await recordFailure(admin, meta);
    throw new MfaError(
      "That code isn't right. Use the newest code from your app, or a backup code.",
    );
  }
}

async function wrongCode(
  admin: Row,
  meta: RequestMeta,
  left: number,
): Promise<never> {
  await recordFailure(admin, meta);
  if (left <= 0) {
    await endChallenge(admin._id);
    throw new MfaError("That code isn't right. Sign in again.", true);
  }
  throw new MfaError(
    `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`,
  );
}

function assertNotLocked(admin: Row) {
  const until = admin.mfaLockedUntil?.getTime() ?? 0;
  if (until <= Date.now()) return;
  const minutes = Math.max(1, Math.ceil((until - Date.now()) / 60_000));
  throw new MfaError(
    `Too many wrong codes. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
  );
}

async function recordFailure(admin: Row, meta: RequestMeta) {
  await logEvent("code-failed", who(admin), meta);
  const after = await Admin.findOneAndUpdate(
    { _id: admin._id },
    { $inc: { mfaFailures: 1 } },
    { returnDocument: "after", projection: { mfaFailures: 1 } },
  ).lean<{ mfaFailures?: number }>();
  if ((after?.mfaFailures ?? 0) < MAX_FAILURES) return;
  await Admin.updateOne(
    { _id: admin._id },
    {
      $set: { mfaLockedUntil: new Date(Date.now() + LOCK_MS) },
      $unset: { mfaFailures: 1 },
    },
  );
  await logEvent("codes-locked", who(admin), meta);
}
