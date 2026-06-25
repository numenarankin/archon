"use client";

import { useState } from "react";
import {
  CalendarPlusIcon,
  CheckIcon,
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
import { STATUSES, statusMeta, type CallStatus, type Prospect } from "@/lib/wildcat/sales";

const FOLLOWUP_DAYS = ["Tomorrow", "In 3 days", "Next week", "In 2 weeks"];
const FOLLOWUP_TIMES = ["9:00 AM", "11:30 AM", "2:00 PM", "4:30 PM"];

/**
 * The action bar across the top of the call card. Each control is a couple of
 * taps — this is a prototype, so the actions show their confirmed state rather
 * than hitting a real calendar/CRM/email backend.
 */
export function CardToolbar({
  prospect,
  onStatusChange,
  onLogNext,
}: {
  prospect: Prospect;
  onStatusChange: (status: CallStatus) => void;
  onLogNext: () => void;
}) {
  const status = statusMeta(prospect.status);
  const [followUp, setFollowUp] = useState<string | null>(null);

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
        {/* Schedule a follow-up — day + time chips, then email the invite. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" />}
          >
            <CalendarPlusIcon />
            Follow-up
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-3">
            <p className="mb-2 text-xs font-semibold text-foreground">
              Schedule a follow-up
            </p>
            <ChipRow label="When" options={FOLLOWUP_DAYS} />
            <ChipRow label="Time" options={FOLLOWUP_TIMES} />
            <Button
              size="sm"
              className="mt-3 w-full"
              onClick={() => setFollowUp(`${FOLLOWUP_DAYS[0]}, ${FOLLOWUP_TIMES[1]}`)}
            >
              Email invite to {prospect.email.split("@")[0]}
            </Button>
            {followUp && (
              <p className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                <CheckIcon className="size-3" />
                Invite sent · {followUp}
              </p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

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
    </div>
  );
}

function ChipRow({ label, options }: { label: string; options: string[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="mb-2">
      <p className="mb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
              active === i
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
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
