import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CreditCard, Store, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Overview" };

const SECTIONS = [
  {
    icon: Store,
    title: "Clients",
    text: "Each restaurant, its plan, links and contact.",
    href: "/clients",
  },
  {
    icon: CreditCard,
    title: "Subscriptions",
    text: "Monthly price, billing day and status.",
  },
  {
    icon: Wallet,
    title: "Payments",
    text: "What's paid, what's due, and reminders.",
  },
] as const;

export default async function OverviewPage() {
  const me = await requireAdmin();
  const first = (me.name || me.email).split(/[\s@]/)[0];

  return (
    <>
      <p className="text-sm font-medium text-primary">Overview</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Welcome, {first}
      </h1>
      <p className="mt-1.5 text-muted-foreground">
        Start with your clients. Subscriptions and payments come next.
      </p>
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const href = "href" in section ? section.href : undefined;
          const body = (
            <>
              <span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary">
                <Icon className="size-5" />
              </span>
              <p className="mt-4 flex items-center gap-1.5 font-semibold">
                {section.title}
                {href ? (
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Soon
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {section.text}
              </p>
            </>
          );
          return href ? (
            <Link
              key={section.title}
              href={href}
              className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-border-strong hover:bg-elevated"
            >
              {body}
            </Link>
          ) : (
            <div
              key={section.title}
              className="rounded-2xl border border-border bg-card p-5 opacity-80"
            >
              {body}
            </div>
          );
        })}
      </div>
    </>
  );
}
