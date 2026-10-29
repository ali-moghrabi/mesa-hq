"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, ShieldAlert } from "lucide-react";

const button =
  "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-elevated/60 px-3.5 text-sm font-medium transition-colors hover:border-border-strong hover:bg-elevated [&_svg]:size-4";

const asText = (codes: string[], account: string) =>
  [
    "MESA HQ backup codes",
    account,
    `Made ${new Date().toLocaleString()}`,
    "",
    ...codes,
    "",
    "Each code works once, instead of the app's code.",
  ].join("\n");

export function RecoveryCodes({
  codes,
  account,
}: {
  codes: string[];
  account: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="rounded-2xl border border-border bg-elevated/50 p-4">
      <p className="flex items-start gap-2.5 text-sm text-pretty text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-accent" />
        <span>
          <span className="font-medium text-foreground">
            Save these now. They won&apos;t be shown again.
          </span>{" "}
          If you lose your phone, each one gets you in once. Keep them away from
          your phone, in a password manager for example.
        </span>
      </p>
      <ol className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-background/70 p-4 font-mono text-[15px] tracking-wide tabular-nums">
        {codes.map((c, i) => (
          <li key={c} className="flex items-baseline gap-2">
            <span className="w-4 text-right text-[11px] text-muted-foreground/60">
              {i + 1}
            </span>
            {c}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={button}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(asText(codes, account));
              setCopied(true);
            } catch {
              /* clipboard blocked: there's still the download */
            }
          }}
        >
          {copied ? <Check className="text-success" /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          className={button}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([asText(codes, account)], { type: "text/plain" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "mesa-hq-backup-codes.txt";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download /> Download
        </button>
      </div>
    </div>
  );
}
