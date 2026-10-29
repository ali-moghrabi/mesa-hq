import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { challengeSetupInfo, readChallenge } from "@/lib/auth/mfa";
import { safeNext } from "@/lib/auth/next";
import { qrSvg } from "@/lib/auth/qr";
import { getSession } from "@/lib/auth/session";
import { AuthShell } from "../AuthShell";
import { SetupForm } from "./SetupForm";

export const metadata: Metadata = { title: "Set up two-step sign-in" };

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const nextValue = safeNext(next) === "/" ? undefined : safeNext(next);
  const pending = await readChallenge();
  if (!pending) {
    if (await getSession())
      return (
        <AuthShell>
          <SetupForm signedIn next={nextValue} />
        </AuthShell>
      );
    redirect("/sign-in");
  }
  if (pending.purpose === "verify")
    redirect(
      `/sign-in/verify${nextValue ? `?next=${encodeURIComponent(nextValue)}` : ""}`,
    );

  const info = await challengeSetupInfo(pending.admin);

  return (
    <AuthShell>
      <SetupForm
        next={nextValue}
        setup={{
          qr: qrSvg(info.uri),
          uri: info.uri,
          secret: info.secret,
          account: info.account,
        }}
      />
    </AuthShell>
  );
}
