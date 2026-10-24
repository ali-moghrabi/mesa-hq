import { isValidObjectId } from "mongoose";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { connectDb } from "@/lib/db";
import { OnboardingRequest } from "@/lib/models/onboarding";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  if (!isValidObjectId(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await connectDb();
  const r = await OnboardingRequest.findById(id, {
    ref: 1,
    config: 1,
    answers: 1,
  }).lean<{ ref: string; config?: string; answers: unknown }>();
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const kind =
    request.nextUrl.searchParams.get("file") === "answers"
      ? "answers"
      : "config";
  const body =
    kind === "answers"
      ? JSON.stringify(r.answers, null, 2)
      : (r.config ?? "{}");

  return new NextResponse(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${r.ref}-${kind}.json"`,
      "cache-control": "no-store",
    },
  });
}
