"use client";

import { useState } from "react";
import {
  CalendarPlusIcon,
  ChevronDownIcon,
  PhoneIcon,
  UserPlusIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FollowUpModal } from "@/components/wildcat/sales/follow-up-modal";
import {
  STATUSES,
  statusMeta,
  type CallStatus,
  type FollowUpOption,
  type Prospect,
} from "@/lib/wildcat/sales";

/**
 * The action bar across the top of the call card. Each control is a couple of
 * taps — this is a prototype, so the actions show their confirmed state rather
 * than hitting a real calendar/CRM/email backend.
 */
export function CardToolbar({
  prospect,
  followUps,
  onStatusChange,
  onLogNext,
}: {
  prospect: Prospect;
  followUps: FollowUpOption[];
  onStatusChange: (status: CallStatus) => void;
  onLogNext: () => void;
}) {
  const status = statusMeta(prospect.status);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {prospect.name}
          </h2>
          <span className="truncate text-xs text-muted-foreground">
            {prospect.title} · {prospect.company}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <PhoneIcon className="size-3" />
          <span className="tabular-nums">{prospect.phone}</span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Schedule a follow-up — opens the full action modal. */}
        <Button variant="outline" size="sm" onClick={() => setFollowUpOpen(true)}>
          <CalendarPlusIcon />
          Follow-up
        </Button>

        {/* Add / correct contact info. */}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <UserPlusIcon />
            Contact
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-3">
            <p className="mb-2 text-xs font-semibold text-foreground">
              Add contact info
            </p>
            <div className="space-y-2">
              <Field label="Direct line" placeholder="(432) 555-0000" />
              <Field label="Email" placeholder={prospect.email} />
              <Field label="Assistant / gatekeeper" placeholder="Name" />
            </div>
            <Button size="sm" className="mt-3 w-full">
              Save to record
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Change call status. */}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <span className={cn("size-1.5 rounded-full", status.dot)} />
            {status.label}
            <ChevronDownIcon className="opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={prospect.status}
              onValueChange={(v) => onStatusChange(v as CallStatus)}
            >
              {STATUSES.map((s) => (
                <DropdownMenuRadioItem key={s.key} value={s.key}>
                  <span className={cn("size-1.5 rounded-full", s.dot)} />
                  {s.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" onClick={onLogNext}>
          Log &amp; next
        </Button>
      </div>

      <FollowUpModal
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        prospect={prospect}
        options={followUps.filter((o) => o.enabled)}
      />
    </div>
  );
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <input
        placeholder={placeholder}
        className="h-7 w-full rounded-md border bg-background px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus-visible:border-ring"
      />
    </label>
  );
}
