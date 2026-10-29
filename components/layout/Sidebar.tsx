"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Inbox,
  LayoutGrid,
  LogOut,
  ShieldCheck,
  Store,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/clients", label: "Clients", icon: Store },
  { href: "/onboarding", label: "Onboarding", icon: Inbox },
  { href: "/health", label: "Health", icon: Activity },
  { href: "/security", label: "Security", icon: ShieldCheck },
] as const;

function useActive() {
  const pathname = usePathname();
  return (href: string, exact?: boolean) =>
    exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground shadow-[0_8px_24px_-8px_var(--primary)]">
        M
      </span>
      <span className="font-semibold tracking-tight">
        MESA <span className="font-normal text-muted-foreground">HQ</span>
      </span>
    </Link>
  );
}

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground tabular-nums">
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function Sidebar({
  name,
  email,
  badges = {},
}: {
  name: string;
  email: string;
  badges?: Record<string, number>;
}) {
  const isActive = useActive();
  const initials = (name || email)
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card/60 px-4 py-5 backdrop-blur lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon, ...rest }) => {
            const active = isActive(href, "exact" in rest);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/12 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className={`size-4.5 ${active ? "text-primary" : ""}`} />
                {label}
                <Badge n={badges[href]} />
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-xl border border-border bg-elevated/60 p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name || "Owner"}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo />
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon, ...rest }) => {
            const active = isActive(href, "exact" in rest);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className={`size-4 ${active ? "text-primary" : ""}`} />
                {label}
                <Badge n={badges[href]} />
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
