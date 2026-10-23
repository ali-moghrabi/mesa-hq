"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, Loader2, NotebookPen } from "lucide-react";
import { saveClientNotes, type NotesState } from "@/lib/clients/actions";

const MAX = 2000;

export function NotesCard({ slug, notes }: { slug: string; notes: string }) {
  const [text, setText] = useState(notes);
  const [saved, setSaved] = useState(notes);
  const [state, action, pending] = useActionState<NotesState, FormData>(
    saveClientNotes.bind(null, slug),
    undefined,
  );

  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setSaved(text.trim());
  }

  const dirty = text.trim() !== saved;
  const showSaved = state?.ok && !dirty && !pending;

  return (
    <form action={action} className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <NotebookPen className="size-4 text-primary" /> Notes
        </h2>
        <span className="text-xs text-muted-foreground">Only for you</span>
      </div>

      <textarea
        name="notes"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && dirty)
            e.currentTarget.form?.requestSubmit();
        }}
        rows={6}
        maxLength={MAX}
        placeholder="Agreed terms, preferences, what they asked for last time…"
        className="mt-4 min-h-36 w-full flex-1 resize-y rounded-xl border border-border bg-background/60 px-3.5 py-3 text-sm leading-relaxed outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-primary/20"
      />

      <div className="mt-3 flex min-h-9 items-center justify-between gap-3">
        <p className="text-xs" aria-live="polite">
          {state?.message && !dirty ? (
            <span className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="size-3.5" /> {state.message}
            </span>
          ) : showSaved ? (
            <span className="flex items-center gap-1.5 text-success">
              <Check className="size-3.5" /> Saved
            </span>
          ) : (
            <span className="text-muted-foreground tabular-nums">
              {text.length.toLocaleString()} / {MAX.toLocaleString()}
            </span>
          )}
        </p>
        {dirty && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setText(saved)}
              disabled={pending}
              className="h-9 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Undo
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-70"
            >
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              {pending ? "Saving…" : "Save notes"}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
