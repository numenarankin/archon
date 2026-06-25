"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { cn } from "@/lib/utils";
import { QueueBoard } from "@/components/wildcat/sales/queue-board";
import { DeskView } from "@/components/wildcat/sales/desk-view";
import { CallHistory } from "@/components/wildcat/sales/call-history";
import {
  HistoryFilters,
  type DateFilter,
  type StatusFilter,
} from "@/components/wildcat/sales/history-filters";
import { ConfigPanel } from "@/components/wildcat/sales/config-panel";
import { type CallRecord, type Prospect, type SalesConfig } from "@/lib/wildcat/sales";
import { saveQueueOrder, saveSalesConfig } from "@/lib/wildcat/sales-actions";

type SalesTab = "queue" | "desk" | "history" | "config";

const TABS: { value: SalesTab; label: string }[] = [
  { value: "queue", label: "Queue" },
  { value: "desk", label: "Desk" },
  { value: "history", label: "History" },
  { value: "config", label: "Config" },
];

export function SalesWorkspace({
  prospects: initial,
  history,
  config: initialConfig,
}: {
  prospects: Prospect[];
  history: CallRecord[];
  config: SalesConfig;
}) {
  const [tab, setTab] = useState<SalesTab>("queue");
  // The lineup is shared: reordering in the Queue changes the dial order on the
  // Desk, since the Desk reads each day's prospects in array order.
  const [prospects, setProspects] = useState<Prospect[]>(initial);
  // The Config tab edits this; the Desk reads from it live.
  const [config, setConfig] = useState<SalesConfig>(initialConfig);
  // History filters live here so they can sit up on the tab row.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  // Mirror the latest prospects so the drag-end persist reads the settled order
  // (hover updates are async), mirroring the Tasks board.
  const prospectsRef = useRef(prospects);
  useEffect(() => {
    prospectsRef.current = prospects;
  }, [prospects]);

  // Persist queue day + position after a drag ends. Renormalizes each day's
  // sort_order to 0,1,2,... so the saved order is stable.
  const persistQueue = useCallback(() => {
    const counters: Record<string, number> = {};
    const items = prospectsRef.current.map((p) => {
      const sortOrder = counters[p.day] ?? 0;
      counters[p.day] = sortOrder + 1;
      return { id: p.id, day: p.day, sortOrder };
    });
    saveQueueOrder(items).catch((e) =>
      console.error("Failed to save queue order", e)
    );
  }, []);

  // Persist config edits, debounced so typing doesn't spam the server action.
  const configTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleConfigChange = useCallback<Dispatch<SetStateAction<SalesConfig>>>(
    (update) => {
      setConfig((prev) => {
        const next =
          typeof update === "function"
            ? (update as (p: SalesConfig) => SalesConfig)(prev)
            : update;
        if (configTimer.current) clearTimeout(configTimer.current);
        configTimer.current = setTimeout(() => {
          saveSalesConfig(next).catch((e) =>
            console.error("Failed to save config", e)
          );
        }, 600);
        return next;
      });
    },
    []
  );

  // Call dates are stable (status edits don't change them), so derive from the
  // server data once.
  const dates = useMemo(
    () =>
      Array.from(new Set(history.map((r) => r.date))).sort((a, b) =>
        b.localeCompare(a)
      ),
    [history]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "font-heading text-2xl font-semibold tracking-tight transition-colors",
                tab === t.value
                  ? "text-foreground"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "history" && (
          <div className="ml-auto">
            <HistoryFilters
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              dateFilter={dateFilter}
              onDateChange={setDateFilter}
              dates={dates}
            />
          </div>
        )}
      </div>

      {tab === "queue" && (
        <QueueBoard
          prospects={prospects}
          onChange={setProspects}
          onPersist={persistQueue}
        />
      )}
      {tab === "desk" && (
        <DeskView
          prospects={prospects}
          config={config}
          onChange={setProspects}
          onPersistQueue={persistQueue}
        />
      )}
      {tab === "history" && (
        <CallHistory
          records={history}
          followUps={config.followUps}
          statusFilter={statusFilter}
          dateFilter={dateFilter}
        />
      )}
      {tab === "config" && (
        <ConfigPanel config={config} onChange={handleConfigChange} />
      )}
    </div>
  );
}
