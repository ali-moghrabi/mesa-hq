/**
 * Health checks from your computer, while HQ isn't deployed (on Vercel the schedule does this).
 *
 *   npm run health            one round, then exit
 *   npm run health -- --watch  a round every 5 minutes, until you stop it (Ctrl+C)
 */
import mongoose from "mongoose";
import { runHealthChecks } from "../lib/health/run";

const EVERY_MIN = 5;
const watch = process.argv.includes("--watch");

const ICON: Record<string, string> = {
  up: "🟢",
  warning: "🟠",
  failing: "🟠",
  down: "🔴",
  unknown: "⚪",
  off: "⚪",
};

async function round() {
  const time = new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Beirut",
  });
  try {
    const summary = await runHealthChecks();
    console.log(
      `\n[${time}] Checked ${summary.checked} client${summary.checked === 1 ? "" : "s"} in ${(summary.ms / 1000).toFixed(1)}s`,
    );
    for (const r of summary.results) {
      const part = (
        label: string,
        p?: { ok: boolean; ms: number; error: string },
      ) => (p ? `${label} ${p.ok ? `${p.ms} ms` : p.error}` : `${label} —`);
      console.log(
        `  ${ICON[r.state] ?? "•"} ${r.name.padEnd(24)} ${part("site", r.website)} · ${part("api", r.api)}`,
      );
      for (const a of r.alerts)
        console.log(
          `     ↳ ${a.channel}${a.to ? ` ${a.to}` : ""} alert ${a.sent ? "sent" : `failed: ${a.error}`}`,
        );
    }
    if (!summary.checked)
      console.log(
        "  Nothing to check: a client needs website stage Live plus a domain or an API address.",
      );
  } catch (error) {
    console.error(`[${time}] The round failed:`, error);
  }
}

async function main() {
  await round();
  if (watch) {
    console.log(`\nChecking every ${EVERY_MIN} minutes. Stop with Ctrl+C.`);
    setInterval(round, EVERY_MIN * 60_000);
  } else {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
