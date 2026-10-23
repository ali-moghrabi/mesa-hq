import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runHealthChecks } from "@/lib/health/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const summary = await runHealthChecks();
  return NextResponse.json(
    {
      checked: summary.checked,
      down: summary.down,
      ms: summary.ms,
      clients: summary.results.map((r) => ({ slug: r.slug, state: r.state })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
