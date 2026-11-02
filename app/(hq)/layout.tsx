import { Sidebar } from "@/components/layout/Sidebar";
import { requireAdmin } from "@/lib/auth/session";
import { countUnread } from "@/lib/onboarding/queries";
import { countBillingAlerts } from "@/lib/billing/queries";

export default async function HqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireAdmin();
  const [unread, billing] = await Promise.all([
    countUnread().catch(() => 0),
    countBillingAlerts().catch(() => 0),
  ]);

  return (
    <div className="min-h-svh">
      <Sidebar
        name={me.name}
        email={me.email}
        badges={{ "/onboarding": unread, "/billing": billing }}
      />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
