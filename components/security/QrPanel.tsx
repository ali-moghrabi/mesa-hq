"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

export function QrPanel({
  qr,
  secret,
  account,
  uri,
}: {
  qr: string;
  secret: string;
  account: string;
  uri?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="@container rounded-2xl border border-border bg-elevated/50 p-4">
      <div className="flex flex-col items-center gap-4 @sm:flex-row @sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- a generated SVG, not a photo */}
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`}
          alt="QR code for your authenticator app"
          width={168}
          height={168}
          className="size-42 shrink-0 rounded-xl bg-white p-1.5 [image-rendering:pixelated]"
        />
        <div className="min-w-0 text-center @sm:text-left">
          {uri && (
            <a
              href={uri}
              className="mb-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary/15 px-4 text-sm font-semibold text-primary sm:hidden"
            >
              Add to the app on this phone
            </a>
          )}
          <p className="text-sm font-medium">Can&apos;t scan it?</p>
          <p className="mt-1 text-xs text-pretty text-muted-foreground">
            In the app, choose &ldquo;Enter a setup key&rdquo;, use{" "}
            <span className="text-foreground">{account}</span> as the name, and
            type:
          </p>
          <div className="mt-2 flex items-center justify-center gap-1 @sm:justify-start">
            <code className="rounded-lg bg-background/70 px-2.5 py-1.5 font-mono text-[13px] leading-relaxed tracking-wide select-all">
              {secret}
            </code>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    secret.replace(/\s/g, ""),
                  );
                  setCopied(true);
                } catch {
                  /* blocked: they can still select it */
                }
              }}
              aria-label={copied ? "Copied" : "Copy the key"}
              className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${copied ? "text-success" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
