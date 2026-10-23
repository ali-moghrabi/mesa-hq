"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // clipboard blocked (http, old browser): nothing to do
        }
      }}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className={`grid size-7 shrink-0 place-items-center rounded-md transition-colors ${
        copied
          ? "text-success"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {copied ? (
        <Check className="size-3.5" strokeWidth={2.5} />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}
