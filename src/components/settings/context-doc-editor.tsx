"use client";

import { useState, useTransition } from "react";
import { HistoryIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listContextRevisions,
  rollbackContextDoc,
  saveContextDoc,
  type ContextRevision,
} from "@/lib/ai/context/actions";
import type { ContextDocType } from "@/lib/ai/context/docs";

interface ContextDocEditorProps {
  docType: ContextDocType;
  title: string;
  blurb: string;
  initialContent: string;
  version: number;
  updatedBy: "user" | "agent" | "system";
  /** Derived docs (the skills menu) are shown read-only. */
  readOnly?: boolean;
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * One context document: a markdown editor with Save plus a revision timeline you
 * can roll back from. Since Archon's self-edits auto-apply, the history + restore
 * here is the user's safety net (and shows what Archon changed and why).
 */
export function ContextDocEditor({
  docType,
  title,
  blurb,
  initialContent,
  version,
  updatedBy,
  readOnly = false,
}: ContextDocEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saved, setSaved] = useState(initialContent);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [history, setHistory] = useState<ContextRevision[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const dirty = content !== saved;

  function save() {
    if (readOnly || !dirty) return;
    setError(null);
    startTransition(async () => {
      try {
        await saveContextDoc(docType, content);
        setSaved(content);
        setHistory(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  function toggleHistory() {
    if (history) {
      setHistory(null);
      return;
    }
    setLoadingHistory(true);
    setError(null);
    listContextRevisions(docType)
      .then(setHistory)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Couldn't load history.")
      )
      .finally(() => setLoadingHistory(false));
  }

  function restore(rev: ContextRevision) {
    setError(null);
    startTransition(async () => {
      try {
        await rollbackContextDoc(docType, rev.content, rev.version);
        setContent(rev.content);
        setSaved(rev.content);
        setHistory(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't restore.");
      }
    });
  }

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            <span className="font-mono text-[10px] text-muted-foreground/60">
              v{version}
            </span>
            {updatedBy === "agent" && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                last edited by Archon
              </span>
            )}
          </div>
          <p className="max-w-xl text-xs text-muted-foreground">{blurb}</p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleHistory}
              disabled={loadingHistory}
            >
              {loadingHistory ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <HistoryIcon className="size-4" />
              )}
              History
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={pending || !dirty}
            >
              {pending && <Loader2Icon className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        {error && (
          <div className="mb-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
        <textarea
          rows={readOnly ? 6 : 12}
          value={content}
          readOnly={readOnly}
          onChange={(e) => setContent(e.target.value)}
          placeholder={readOnly ? "" : "Empty. Archon will fill this in as it learns."}
          className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-[13px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 read-only:opacity-70 dark:bg-input/30"
        />
        {readOnly && (
          <p className="mt-1.5 text-xs text-muted-foreground/70">
            Generated from your skills. Edit a skill to change this.
          </p>
        )}

        {history && (
          <div className="mt-3 flex flex-col gap-1.5 border-t pt-3">
            <span className="text-xs font-medium text-muted-foreground">
              Revision history
            </span>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground/70">No revisions yet.</p>
            ) : (
              history.map((rev) => (
                <div
                  key={rev.id}
                  className="flex items-start justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs">
                      <span className="font-mono">v{rev.version}</span>
                      {" · "}
                      <span className="text-muted-foreground">
                        {rev.updatedBy === "agent"
                          ? "Archon"
                          : rev.updatedBy === "user"
                            ? "You"
                            : "System"}
                      </span>
                      {" · "}
                      <span className="text-muted-foreground/70">
                        {when(rev.createdAt)}
                      </span>
                    </span>
                    {rev.rationale && (
                      <span className="text-[11px] text-muted-foreground/80">
                        {rev.rationale}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending || rev.content === saved}
                    onClick={() => restore(rev)}
                  >
                    <RotateCcwIcon className="size-3.5" />
                    Restore
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
