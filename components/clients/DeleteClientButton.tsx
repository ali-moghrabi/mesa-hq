"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { deleteClient, type DeleteClientState } from "@/lib/clients/actions";

export function DeleteClientButton({
  name,
  slug,
  variant = "icon",
  size = "sm",
  redirectTo,
}: {
  name: string;
  slug: string;
  variant?: "icon" | "full";
  size?: "sm" | "lg";
  redirectTo?: "/clients";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState<DeleteClientState, FormData>(
    deleteClient,
    undefined,
  );
  const titleId = useId();
  const matches = typed.trim().toLowerCase() === slug;

  const open = () => {
    setTyped("");
    dialog.current?.showModal();
    requestAnimationFrame(() => input.current?.focus());
  };
  const close = () => {
    if (!pending) dialog.current?.close();
  };

  useEffect(() => {
    if (state?.deleted) dialog.current?.close();
  }, [state]);

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={open}
          aria-label={`Delete ${name}`}
          title="Delete"
          className={`grid place-items-center border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive ${
            size === "lg"
              ? "size-10 rounded-xl bg-elevated/60"
              : "size-8 rounded-lg"
          }`}
        >
          <Trash2 className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={open}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/15"
        >
          <Trash2 className="size-4" /> Delete client
        </button>
      )}

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-border-strong bg-card p-0 text-foreground shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop:bg-black/65 backdrop:backdrop-blur-sm"
      >
        <form action={action} className="p-6">
          <input type="hidden" name="slug" value={slug} />
          {redirectTo && (
            <input type="hidden" name="redirectTo" value={redirectTo} />
          )}

          <div className="flex items-start justify-between gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-destructive/12 text-destructive">
              <AlertTriangle className="size-5" />
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <h2
            id={titleId}
            className="mt-4 text-lg font-semibold tracking-tight"
          >
            Delete {name}?
          </h2>
          <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
            Its contact, plan, billing and notes are removed from HQ for good.
            This can&apos;t be undone. Their website itself isn&apos;t touched.
          </p>
          <p className="mt-3 rounded-xl border border-border bg-elevated/60 px-3.5 py-2.5 text-sm text-muted-foreground">
            Only stopping for a while? Set the status to{" "}
            <span className="text-foreground">Paused</span> or{" "}
            <span className="text-foreground">Cancelled</span> instead, and keep
            the history.
          </p>

          <label className="mt-5 block text-sm">
            <span>
              Type{" "}
              <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground select-all">
                {slug}
              </code>{" "}
              to confirm
            </span>
            <input
              ref={input}
              name="confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3.5 font-mono text-[15px] outline-none transition-[border-color,box-shadow] focus:border-destructive focus:ring-3 focus:ring-destructive/20"
            />
          </label>

          {state?.message && (
            <p
              role="alert"
              className="mt-3 flex items-center gap-1.5 text-sm text-destructive"
            >
              <AlertCircle className="size-3.5 shrink-0" /> {state.message}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="h-11 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
            >
              Keep client
            </button>
            <button
              type="submit"
              disabled={!matches || pending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-destructive px-4 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {pending ? "Deleting…" : "Delete for good"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
