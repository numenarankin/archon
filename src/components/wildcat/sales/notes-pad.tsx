"use client";

import { Pencil } from "lucide-react";

/**
 * The bottom half of the call card: free-form notes the rep types during the
 * call. Controlled by the Desk so the text persists with the logged call.
 */
export function NotesPad({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 px-4 pt-2.5 pb-1">
        <Pencil className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Call notes
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type notes as you talk — saved to the CRM with the transcript when the call ends."
        className="min-h-0 flex-1 resize-none bg-transparent px-4 pb-4 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}
