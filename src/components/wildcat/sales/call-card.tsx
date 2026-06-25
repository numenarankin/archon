"use client";

import { CardToolbar } from "@/components/wildcat/sales/card-toolbar";
import { ScriptPanel } from "@/components/wildcat/sales/script-panel";
import { Dossier } from "@/components/wildcat/sales/dossier";
import { NotesPad } from "@/components/wildcat/sales/notes-pad";
import type {
  CallStatus,
  FollowUpOption,
  Objection,
  Prospect,
} from "@/lib/wildcat/sales";

/**
 * The active call: a notepad-style card. Toolbar on top, the opening script +
 * objections down the left, and the dossier-over-notepad on the right. The
 * script, objections, and follow-up actions all come from the Config tab.
 */
export function CallCard({
  prospect,
  script,
  objections,
  followUps,
  onStatusChange,
  onLogNext,
}: {
  prospect: Prospect;
  /** Opening script, already rendered for this prospect. */
  script: string;
  objections: Objection[];
  followUps: FollowUpOption[];
  onStatusChange: (status: CallStatus) => void;
  onLogNext: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <CardToolbar
        prospect={prospect}
        followUps={followUps}
        onStatusChange={onStatusChange}
        onLogNext={onLogNext}
      />
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-72 shrink-0 border-r md:flex md:min-h-0 md:flex-col">
          {/* Keyed so the script collapse/expand state resets per prospect. */}
          <ScriptPanel key={prospect.id} script={script} objections={objections} />
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
