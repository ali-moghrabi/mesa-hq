import mongoose from "mongoose";
import { connectDb } from "../lib/db";
import { hashPassword, PASSWORD_MIN } from "../lib/auth/password";
import { Admin } from "../lib/models/admin";

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    let value = "";
    const raw = hidden && stdin.isTTY;
    if (raw) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\u0003") process.exit(130);
        if (ch === "\r" || ch === "\n") {
          stdin.off("data", onData);
          if (raw) stdin.setRawMode(false);
          stdin.pause();
          stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += ch;
        if (!hidden) stdout.write(ch);
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const [emailArg, ...nameParts] = process.argv.slice(2);
  const email = (emailArg ?? (await ask("Email: "))).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    throw new Error(`"${email}" isn't a valid email`);

  const password = await ask(
    `Password (at least ${PASSWORD_MIN} characters): `,
    true,
  );
  if (password.length < PASSWORD_MIN)
    throw new Error(`The password needs at least ${PASSWORD_MIN} characters`);
  if ((await ask("Type it again: ", true)) !== password)
    throw new Error("The two passwords don't match");

  await connectDb();
  const passwordHash = await hashPassword(password);
  const existing = await Admin.findOne({ email }).lean();
  if (existing) {
    await Admin.updateOne(
      { _id: existing._id },
      {
        $set: {
          passwordHash,
          active: true,
          ...(nameParts.length && { name: nameParts.join(" ") }),
        },
        $inc: { tokenVersion: 1 },
      },
    );
    console.log(
      `\n✔ Password reset for ${email}. Every existing session was signed out.`,
    );
  } else {
    await Admin.create({
      email,
      name: nameParts.join(" "),
      passwordHash,
      role: "owner",
    });
    console.log(`\n✔ Admin created: ${email}. Sign in at /sign-in.`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(`\n✖ ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
