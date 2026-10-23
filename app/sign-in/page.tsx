import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
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
    <main className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-card p-12 text-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="absolute -top-40 -left-32 size-136 rounded-full bg-primary opacity-30 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="absolute -right-24 -bottom-48 size-112 rounded-full bg-highlight opacity-15 blur-[120px]"
        />
        <Logo />
        <div className="relative max-w-md">
          <p className="text-sm font-semibold tracking-[0.18em] text-highlight uppercase">
            Headquarters
          </p>
          <h1 className="mt-4 text-5xl leading-[1.05] font-semibold tracking-tight text-balance">
            Every client, every plan, every payment.
          </h1>
          <p className="mt-5 text-lg text-foreground/65">
            The private side of MESA: who you work with, what they pay, and
            what&apos;s due.
          </p>
        </div>
        <p className="relative text-sm text-foreground/45">
          Private. For the MESA team only.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-2 text-muted-foreground">
            Welcome back. Enter your details to continue.
          </p>
          <SignInForm next={typeof next === "string" ? next : undefined} />
        </div>
      </section>
    </main>
  );
}

function Logo() {
  return (
    <div className="relative flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground shadow-[0_10px_30px_-10px_var(--primary)]">
        M
      </span>
      <span className="text-lg font-semibold tracking-tight">
        MESA <span className="font-normal opacity-60">HQ</span>
      </span>
    </div>
  );
}
