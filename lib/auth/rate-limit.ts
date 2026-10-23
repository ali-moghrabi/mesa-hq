import { LoginAttempt } from "../models/login-attempt";

const WINDOW_MS = 15 * 60_000;
const LIMITS = { email: 5, ip: 20 } as const;

const keys = (email: string, ip: string) => ({
  email: `email:${email}`,
  ip: `ip:${ip}`,
});

export async function waitMinutes(
  email: string,
  ip: string,
  now = Date.now(),
): Promise<number> {
  const k = keys(email, ip);
  const since = new Date(now - WINDOW_MS);
  let wait = 0;
  for (const [kind, key] of [
    ["email", k.email],
    ["ip", k.ip],
  ] as const) {
    const recent = await LoginAttempt.find(
      { key, at: { $gt: since } },
      { at: 1 },
    )
      .sort({ at: -1 })
      .limit(LIMITS[kind])
      .lean();
    if (recent.length >= LIMITS[kind]) {
      const oldest = recent[recent.length - 1].at.getTime();
      wait = Math.max(wait, Math.ceil((oldest + WINDOW_MS - now) / 60_000));
    }
  }
  return wait;
}

export async function recordFailure(email: string, ip: string): Promise<void> {
  const k = keys(email, ip);
  const at = new Date();
  await LoginAttempt.insertMany([
    { key: k.email, at },
    { key: k.ip, at },
  ]);
}

export async function clearFailures(email: string): Promise<void> {
  await LoginAttempt.deleteMany({ key: keys(email, "").email });
}
