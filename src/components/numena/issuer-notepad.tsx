"use client";

import { useState } from "react";

/** localStorage key prefix; notes are scoped per SEC accession number. */
const STORAGE_PREFIX = "numena:issuer-notes:";

function storageKey(accessionNo: string): string {
  return STORAGE_PREFIX + accessionNo;
}

/** Read this issuer's saved note, tolerating unavailable storage. */
function loadNote(accessionNo: string | null): string {
  if (!accessionNo) return "";
  try {
    return window.localStorage.getItem(storageKey(accessionNo)) ?? "";
  } catch {
    return "";
  }
}

/**
 * A free-form notes pane for the issuer modal. Notes are kept per filing
 * (accession number) in localStorage, so they persist across reopens without
 * needing a backend. Purely client-side.
 *
 * The parent remounts this via a `key` on the accession number, so the initial
 * note loads in the lazy state initializer and no effect is needed.
 */
export function IssuerNotepad({ accessionNo }: { accessionNo: string | null }) {
  const [value, setValue] = useState(() => loadNote(accessionNo));
  const [saved, setSaved] = useState(false);

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    setValue(next);
    if (!accessionNo) return;
    try {
      window.localStorage.setItem(storageKey(accessionNo), next);
      setSaved(true);
    } catch {
      // Ignore write failures (private mode / quota exceeded).
    }
  }

  return (
    <div className="flex h-48 min-h-0 shrink-0 flex-col border-t bg-muted/20 md:h-auto md:w-[34rem] md:border-l md:border-t-0">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Notes
        </h3>
        {saved && (
          <span className="text-[0.65rem] text-muted-foreground">Saved</span>
        )}
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        disabled={!accessionNo}
        placeholder="Jot down notes, call plans, and next steps for this prospect..."
        className="min-h-0 flex-1 resize-none bg-transparent px-4 pb-4 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  );
}
