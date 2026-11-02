import type { Metadata } from "next";
import { CheckCircle2, CircleSlash } from "lucide-react";

export const metadata: Metadata = { title: "Subscription" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BillingDonePage({ searchParams }: Props) {
  const ok = (await searchParams).ok === "1";
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden px-5 py-16">
      <div
        aria-hidden="true"
        className="absolute -top-40 left-1/2 size-136 -translate-x-1/2 rounded-full bg-primary opacity-20 blur-[120px]"
      />
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]">
        <span
          className={`mx-auto grid size-16 place-items-center rounded-full ${
            ok ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"
          }`}
        >
          {ok ? (
            <CheckCircle2 className="size-8" />
          ) : (
            <CircleSlash className="size-8" />
          )}
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          {ok ? "You're all set" : "Nothing was changed"}
        </h1>
        <p className="mt-2 text-pretty text-muted-foreground">
          {ok
            ? "Your card is saved securely with Stripe. Your MESA subscription now renews by itself, and you'll get a receipt by email each time."
            : "You left before adding a card. Open the link we sent you again whenever you're ready."}
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Questions? Just reply to our message.
        </p>
        <p className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-extrabold text-primary-foreground">
            M
          </span>
          MESA
        </p>
      </div>
    </main>
  );
}
