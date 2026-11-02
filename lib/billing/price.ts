import "server-only";
import { cycleOf } from "../clients/options";
import { stripe, type StripeSubscription } from "./stripe";
import { syncSubscription } from "./sync";

export async function pushPriceToStripe(
  subscriptionId: string,
  next: { amountCents: number; currency: string; cycle: string },
): Promise<void> {
  const sub = await stripe<
    StripeSubscription & {
      items: { data: { id: string; price: { product: string } }[] };
    }
  >("GET", `/subscriptions/${subscriptionId}`);
  const item = sub.items.data[0];
  if (!item) return;
  const cycle = cycleOf(next.cycle);
  await stripe("POST", `/subscriptions/${subscriptionId}`, {
    proration_behavior: "none",
    items: [
      {
        id: item.id,
        price_data: {
          currency: next.currency.toLowerCase(),
          product: item.price.product,
          unit_amount: next.amountCents,
          recurring: {
            interval: cycle.interval,
            interval_count: cycle.intervalCount,
          },
        },
      },
    ],
  });
  await syncSubscription(subscriptionId);
}
