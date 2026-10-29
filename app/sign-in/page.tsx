import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AuthShell } from "./AuthShell";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  if (await getSession()) redirect("/");
  const { next } = await searchParams;

  return (
    <AuthShell>
      <h2 className="text-3xl font-semibold tracking-tight">Sign in</h2>
      <p className="mt-2 text-muted-foreground">
        Welcome back. Enter your details to continue.
      </p>
      <SignInForm next={typeof next === "string" ? next : undefined} />
    </AuthShell>
  );
}
