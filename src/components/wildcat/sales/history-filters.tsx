"use client";

import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUSES, statusMeta, type CallStatus } from "@/lib/wildcat/sales";

export type StatusFilter = CallStatus | "all";
export type DateFilter = string | "all";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatHistoryDate(iso: string): string {
  return dateFmt.format(new Date(`${iso}T00:00:00Z`));
}

/**
 * Status + date filters for the call history. Lives up on the tab row so the
 * table itself gets the full remaining height.
 */
export function HistoryFilters({
  statusFilter,
  onStatusChange,
  dateFilter,
  onDateChange,
  dates,
}: {
  statusFilter: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
  dateFilter: DateFilter;
  onDateChange: (v: DateFilter) => void;
  dates: string[];
}) {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          Status:{" "}
          <span className="font-normal text-muted-foreground">
            {statusFilter === "all" ? "All" : statusMeta(statusFilter).label}
          </span>
          <ChevronDownIcon className="opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={statusFilter}
            onValueChange={(v) => onStatusChange(v as StatusFilter)}
          >
            <DropdownMenuRadioItem value="all">All statuses</DropdownMenuRadioItem>
            {STATUSES.filter((s) => s.key !== "new").map((s) => (
              <DropdownMenuRadioItem key={s.key} value={s.key}>
                <span className={cn("size-1.5 rounded-full", s.dot)} />
                {s.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          Date:{" "}
          <span className="font-normal text-muted-foreground">
            {dateFilter === "all" ? "All" : formatHistoryDate(dateFilter)}
          </span>
          <ChevronDownIcon className="opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72">
          <DropdownMenuRadioGroup
            value={dateFilter}
            onValueChange={(v) => onDateChange(v as DateFilter)}
          >
            <DropdownMenuRadioItem value="all">All dates</DropdownMenuRadioItem>
            {dates.map((d) => (
              <DropdownMenuRadioItem key={d} value={d}>
                {formatHistoryDate(d)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
