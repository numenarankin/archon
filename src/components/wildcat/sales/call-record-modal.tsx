"use client";

import { useState } from "react";
import {
  CalendarPlusIcon,
  ChevronDownIcon,
  ClockIcon,
  MailIcon,
  PhoneIcon,
  UserPlusIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import { Dossier } from "@/components/wildcat/sales/dossier";
import { TranscriptPanel } from "@/components/wildcat/sales/transcript-panel";
import { FollowUpModal } from "@/components/wildcat/sales/follow-up-modal";
import {
  STATUSES,
  statusMeta,
  type CallRecord,
  type CallStatus,
  type FollowUpOption,
} from "@/lib/wildcat/sales";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatDate(iso: string): string {
  return dateFmt.format(new Date(`${iso}T00:00:00Z`));
}

/**
 * The big call-detail view: prospect details + actions at the top of the main
 * column, the logged notes beneath, and the call transcript on the right. No
 * lineup or live script — this is a record of a call that already happened.
 */
export function CallRecordModal({
  record,
  followUps,
  onClose,
  onStatusChange,
}: {
  record: CallRecord | null;
  followUps: FollowUpOption[];
  onClose: () => void;
  onStatusChange: (recordId: string, status: CallStatus) => void;
}) {
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  const open = record !== null;
  // Keep the last record around during the close animation so it doesn't blank.
  const [shown, setShown] = useState<CallRecord | null>(record);
  if (record && record !== shown) setShown(record);

  const active = record ?? shown;
  if (!active) return null;

  const prospect = active.prospect;
  const status = statusMeta(prospect.status);

  return (
    <>
      <SwipeUpModal
        open={open}
        onClose={onClose}
        title={prospect.name}
        description={`${formatDate(active.date)} · ${active.time} · ${active.duration}`}
        className="h-[85vh] max-w-6xl"
      >
        <div className="flex min-h-0 flex-1 gap-3 p-3">
          {/* Main column: details + actions, then notes. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-foreground">
                    {prospect.name}
                  </h3>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium"
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", status.dot)} />
                    {status.label}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {prospect.title} · {prospect.company}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <PhoneIcon className="size-3" />
                    <span className="tabular-nums">{prospect.phone}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MailIcon className="size-3" />
                    {prospect.email}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon className="size-3" />
                    {active.duration}
                  </span>
                </div>
              </div>

              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                    Actions
                    <ChevronDownIcon className="opacity-60" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => setFollowUpOpen(true)}>
                      <CalendarPlusIcon />
                      Schedule follow-up
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <UserPlusIcon />
                      Add contact info
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={prospect.status}
                      onValueChange={(v) =>
                        onStatusChange(active.id, v as CallStatus)
                      }
                    >
                      <DropdownMenuLabel>Status</DropdownMenuLabel>
                      {STATUSES.filter((s) => s.key !== "new").map((s) => (
                        <DropdownMenuRadioItem key={s.key} value={s.key}>
                          <span className={cn("size-1.5 rounded-full", s.dot)} />
                          {s.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <Dossier prospect={prospect} />
              <div className="flex flex-1 flex-col px-4 py-3">
                <span className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Call notes
                </span>
                <p className="text-sm leading-relaxed text-foreground">
                  {active.notes}
                </p>
              </div>
            </div>
          </div>

          {/* Transcript — a saved record, not a live call. */}
          <TranscriptPanel
            lines={prospect.transcript}
            open={transcriptOpen}
            onToggle={() => setTranscriptOpen((v) => !v)}
            live={false}
            duration={active.duration}
          />
        </div>
      </SwipeUpModal>

      <FollowUpModal
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        prospect={prospect}
        options={followUps.filter((o) => o.enabled)}
      />
    </>
  );
}
