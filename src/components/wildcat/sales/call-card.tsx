"use client";

import { CardToolbar } from "@/components/wildcat/sales/card-toolbar";
import { ScriptPanel } from "@/components/wildcat/sales/script-panel";
import { Dossier } from "@/components/wildcat/sales/dossier";
import { NotesPad } from "@/components/wildcat/sales/notes-pad";
import type { CallStatus, Prospect } from "@/lib/wildcat/sales";

/**
 * The active call: a notepad-style card. Toolbar on top, the opening script +
 * objections down the left, and the dossier-over-notepad on the right.
 */
export function CallCard({
  prospect,
  onStatusChange,
  onLogNext,
}: {
  prospect: Prospect;
  onStatusChange: (status: CallStatus) => void;
  onLogNext: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <CardToolbar
        prospect={prospect}
        onStatusChange={onStatusChange}
        onLogNext={onLogNext}
      />
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-72 shrink-0 border-r md:flex md:flex-col md:min-h-0">
          {/* Keyed so the script collapse/expand state resets per prospect. */}
          <ScriptPanel
            key={prospect.id}
            script={prospect.openingScript}
            objections={prospect.objections}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <Dossier prospect={prospect} />
          {/* Keyed so the textarea clears when the rep moves to the next call. */}
          <NotesPad key={prospect.id} />
        </div>
      </div>
    </div>
  );
}
