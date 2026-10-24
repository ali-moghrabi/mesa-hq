import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { saveSubmission } from "@/lib/onboarding/save";
import { onboardingPayloadSchema } from "@/lib/onboarding/schema";

export const dynamic = "force-dynamic";

const MAX_AGE_S = 5 * 60;
const MAX_BYTES = 1_000_000;

function verify(
  secret: string,
  timestamp: string,
  body: string,
  given: string,
) {
  const expected = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const secret = process.env.ONBOARDING_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Onboarding isn't set up in HQ (ONBOARDING_SECRET)" },
      { status: 503 },
    );

  const body = await request.text();
  if (body.length > MAX_BYTES)
    return NextResponse.json({ error: "Too large" }, { status: 413 });

  const timestamp = request.headers.get("x-mesa-timestamp") ?? "";
  const signature = request.headers.get("x-mesa-signature") ?? "";
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!timestamp || !Number.isFinite(age) || age > MAX_AGE_S)
    return NextResponse.json({ error: "Expired" }, { status: 401 });
  if (!verify(secret, timestamp, body, signature))
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Not JSON" }, { status: 400 });
  }
  const parsed = onboardingPayloadSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${issue.path.join(".")}: ${issue.message}` },
      { status: 422 },
    );
  }

  const saved = await saveSubmission(parsed.data, "webhook");
  return NextResponse.json(
    { ok: true, id: saved.id, created: saved.created },
    { status: saved.created ? 201 : 200 },
  );
}
