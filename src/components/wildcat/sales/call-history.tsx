"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CallRecordModal } from "@/components/wildcat/sales/call-record-modal";
import {
  formatHistoryDate,
  type DateFilter,
  type StatusFilter,
} from "@/components/wildcat/sales/history-filters";
import {
  statusMeta,
  type CallRecord,
  type CallStatus,
  type FollowUpOption,
} from "@/lib/wildcat/sales";

export function CallHistory({
  records: initial,
  followUps,
  statusFilter,
  dateFilter,
}: {
  records: CallRecord[];
  followUps: FollowUpOption[];
  statusFilter: StatusFilter;
  dateFilter: DateFilter;
}) {
  const [records, setRecords] = useState<CallRecord[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      records.filter(
        (r) =>
          (statusFilter === "all" || r.prospect.status === statusFilter) &&
          (dateFilter === "all" || r.date === dateFilter)
      ),
    [records, statusFilter, dateFilter]
  );

  const selected = records.find((r) => r.id === selectedId) ?? null;

  function handleStatusChange(recordId: string, status: CallStatus) {
    setRecords((prev) =>
      prev.map((r) =>
        r.id === recordId ? { ...r, prospect: { ...r.prospect, status } } : r
      )
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-[0.1rem] border">
      <Table className="text-[0.95rem]">
        <TableHeader className="[&_th]:h-9 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow className="sticky top-0 z-10 bg-muted/50 hover:bg-muted/50">
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Prospect</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-muted-foreground"
              >
                No calls match these filters.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((r) => {
              const status = statusMeta(r.prospect.status);
              return (
                <TableRow
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className="cursor-pointer [&>td]:py-1.5"
                >
                  <TableCell className="tabular-nums">
                    {formatHistoryDate(r.date)}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {r.time}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-foreground">
                      {r.prospect.name}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {r.prospect.company}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {r.prospect.phone}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {r.duration}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn("size-1.5 rounded-full", status.dot)} />
                      {status.label}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <CallRecordModal
        record={selected}
        followUps={followUps}
        onClose={() => setSelectedId(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
