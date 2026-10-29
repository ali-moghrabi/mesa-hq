import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readChallenge } from "@/lib/auth/mfa";
import { safeNext } from "@/lib/auth/next";
import { getSession } from "@/lib/auth/session";
import { AuthShell } from "../AuthShell";
import { VerifyForm } from "./VerifyForm";

export const metadata: Metadata = { title: "Two-step sign-in" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  if (await getSession()) redirect("/");
  const { next } = await searchParams;
  const nextValue = safeNext(next) === "/" ? undefined : safeNext(next);
  const pending = await readChallenge();
  if (!pending) redirect("/sign-in");
  if (pending.purpose === "setup")
    redirect(
      `/sign-in/setup${nextValue ? `?next=${encodeURIComponent(nextValue)}` : ""}`,
    );

  return (
    <AuthShell>
      <h2 className="text-3xl font-semibold tracking-tight">
        Two-step sign-in
      </h2>
      <p className="mt-2 text-pretty text-muted-foreground">
        Open your authenticator app and enter the code for{" "}
        <span className="font-medium text-foreground">MESA HQ</span> (
        {pending.admin.email}).
      </p>
      <VerifyForm next={nextValue} />
    </AuthShell>
  );
}
