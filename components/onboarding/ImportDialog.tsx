"use client";

import { useActionState, useId, useRef, useState } from "react";
import { AlertCircle, FileJson, Loader2, Mail, Upload, X } from "lucide-react";
import { importRequest, type ImportState } from "@/lib/onboarding/actions";

export function ImportDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, action, pending] = useActionState<ImportState, FormData>(
    importRequest,
    undefined,
  );
  const [answers, setAnswers] = useState("");
  const [config, setConfig] = useState("");

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-elevated/60 px-4 text-sm font-medium transition-colors hover:border-border-strong hover:bg-elevated"
      >
        <Upload className="size-4 text-muted-foreground" /> Import from email
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(e) => {
          if (e.target === e.currentTarget && !pending) dialog.current?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-border-strong bg-card p-0 text-foreground shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop:bg-black/65 backdrop:backdrop-blur-sm"
      >
        <form action={action} className="p-6">
          <div className="flex items-start justify-between gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
              <Mail className="size-5" />
            </span>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
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
            Import from the onboarding email
          </h2>
          <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
            Every onboarding email has two files attached. Download them and
            choose them here. Importing the same request twice just updates it.
          </p>

          <div className="mt-5 space-y-3">
            <FilePick
              name="answers"
              label="Answers"
              hint="…-answers.json"
              chosen={answers}
              onPick={setAnswers}
              required
            />
            <FilePick
              name="config"
              label="Site config"
              hint="…-config.json, for npm run new-site"
              chosen={config}
              onPick={setConfig}
            />
          </div>

          {state?.message && !pending && (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.message}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              disabled={pending}
              className="h-11 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!answers || pending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {pending ? "Importing…" : "Import request"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function FilePick({
  name,
  label,
  hint,
  chosen,
  onPick,
  required,
}: {
  name: string;
  label: string;
  hint: string;
  chosen: string;
  onPick: (name: string) => void;
  required?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition-colors focus-within:border-primary hover:border-border-strong ${
        chosen ? "border-primary/40 bg-primary/6" : "border-border-strong"
      }`}
    >
      <FileJson
        className={`size-5 shrink-0 ${chosen ? "text-primary" : "text-muted-foreground"}`}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {label}
          {!required && (
            <span className="ml-1.5 font-normal text-muted-foreground">
              optional
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {chosen || hint}
        </span>
      </span>
      <span className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-medium">
        {chosen ? "Change" : "Choose"}
      </span>
      <input
        type="file"
        name={name}
        accept="application/json,.json"
        required={required}
        onChange={(e) => onPick(e.target.files?.[0]?.name ?? "")}
        className="sr-only"
      />
    </label>
  );
}
