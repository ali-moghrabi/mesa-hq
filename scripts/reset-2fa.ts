import mongoose from "mongoose";
import { createInterface } from "node:readline/promises";
import { connectDb } from "../lib/db";
import { Admin } from "../lib/models/admin";
import { SecurityEvent } from "../lib/models/security-event";

/*
 * For a lost phone AND lost backup codes: turns two-step sign-in off for one account and
 * signs it out everywhere. Their next sign-in asks them to set it up again (new QR code).
 * Needs the database connection, so only someone with the server's secrets can run it.
 *
 *   npm run reset-2fa someone@example.com
 */
async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run reset-2fa someone@example.com");

  await connectDb();
  const admin = await Admin.findOne({ email }).lean();
  if (!admin) throw new Error(`No HQ account for ${email}`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const typed = (
    await rl.question(
      `This turns off two-step sign-in for ${email} and signs them out everywhere.\nType the email again to confirm: `,
    )
  )
    .trim()
    .toLowerCase();
  rl.close();
  if (typed !== email) throw new Error("Didn't match. Nothing changed.");

  await Admin.updateOne(
    { _id: admin._id },
    {
      $set: { mfaEnabled: false },
      $inc: { tokenVersion: 1 },
      $unset: {
        mfaEnabledAt: 1,
        mfaSecret: 1,
        mfaLastStep: 1,
        mfaRecoveryCodes: 1,
        mfaFailures: 1,
        mfaLockedUntil: 1,
        challengeHash: 1,
        challengePurpose: 1,
        challengeExpiresAt: 1,
        challengeAttempts: 1,
        challengeSecret: 1,
      },
    },
  );
  await SecurityEvent.create({
    type: "mfa-reset",
    adminId: admin._id,
    email,
    ip: "server (script)",
    userAgent: "",
  });
  console.log(
    `\n✔ Two-step sign-in reset for ${email}. They'll set it up again on their next sign-in.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(`\n✖ ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
