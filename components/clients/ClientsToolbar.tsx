"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Loader2, Search, X } from "lucide-react";
import { SORTS, type SortId } from "@/lib/clients/list";

export function ClientsToolbar({ q, sort }: { q: string; sort: SortId }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState(q);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    setText(q);
  }

  const go = (change: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(change)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (next.get("sort") === "recent") next.delete("sort");
    for (const key of ["created", "updated", "deleted"]) next.delete(key);
    const query = next.toString();
    startTransition(() =>
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      }),
    );
  };

  // Typing: wait until a pause, then search
  useEffect(() => {
    const value = text.trim();
    if (value === q) return;
    const timer = setTimeout(() => go({ q: value || undefined }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go() reads the latest URL itself
  }, [text]);

  // "/" focuses the search, like on most dashboards
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <label className="relative flex-1">
        <span className="sr-only">Search clients</span>
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted-foreground">
          {pending ? (
            <Loader2 className="size-4.5 animate-spin" />
          ) : (
            <Search className="size-4.5" />
          )}
        </span>
        <input
          ref={input}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && text) {
              e.preventDefault();
              setText("");
            }
          }}
          placeholder="Search by name, city, contact, email or phone"
          className="h-11 w-full rounded-xl border border-border bg-card pr-20 pl-10.5 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
        />
        {text ? (
          <button
            type="button"
            onClick={() => {
              setText("");
              input.current?.focus();
            }}
            aria-label="Clear the search"
            className="absolute inset-y-0 right-2 my-auto grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute inset-y-0 right-3 my-auto hidden h-6 items-center rounded-md border border-border px-1.5 font-sans text-xs text-muted-foreground sm:flex">
            /
          </kbd>
        )}
      </label>

      <label className="relative sm:w-52">
        <span className="sr-only">Sort</span>
        <ArrowUpDown className="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-4 text-muted-foreground" />
        <select
          value={sort}
          onChange={(e) => go({ sort: e.target.value })}
          className="h-11 w-full appearance-none rounded-xl border border-border bg-card pr-4 pl-10 text-sm font-medium outline-none transition-colors hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-primary/20"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
