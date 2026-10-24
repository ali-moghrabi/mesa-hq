"use client";

import { useTransition } from "react";
import {
  Archive,
  Eye,
  Loader2,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { deleteRequest, setRequestStatus } from "@/lib/onboarding/actions";
import type { RequestStatus } from "@/lib/onboarding/schema";

export function RequestActions({
  id,
  status,
}: {
  id: string;
  status: RequestStatus;
}) {
  const [pending, start] = useTransition();
  const set = (next: RequestStatus) => start(() => setRequestStatus(id, next));

  const buttons: {
    to: RequestStatus;
    label: string;
    icon: React.ReactElement;
    show: boolean;
    danger?: boolean;
  }[] = [
    {
      to: "reviewing",
      label: "Reviewing",
      icon: <Eye />,
      show: status === "new",
    },
    {
      to: "new",
      label: "Back to new",
      icon: <RotateCcw />,
      show:
        status === "declined" ||
        status === "archived" ||
        status === "reviewing",
    },
    {
      to: "declined",
      label: "Decline",
      icon: <XCircle />,
      show: status === "new" || status === "reviewing",
      danger: true,
    },
    {
      to: "archived",
      label: "Archive",
      icon: <Archive />,
      show: status !== "archived",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {buttons
        .filter((b) => b.show)
        .map((b) => (
          <button
            key={b.to}
            type="button"
            disabled={pending}
            onClick={() => set(b.to)}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors disabled:opacity-60 [&_svg]:size-4 ${
              b.danger
                ? "border-border text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                : "border-border bg-elevated/60 hover:border-border-strong hover:bg-elevated"
            }`}
          >
            {b.icon}
            {b.label}
          </button>
        ))}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            window.confirm(
              "Delete this request for good? Use it for spam or tests. Its files on S3 stay.",
            )
          )
            start(() => deleteRequest(id));
        }}
        aria-label="Delete the request"
        title="Delete"
        className="grid size-10 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
      </button>
    </div>
  );
}
