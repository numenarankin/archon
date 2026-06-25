"use client";

import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ChevronLeftIcon, ChevronRightIcon, PhoneCallIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/numena/kpis/segmented";
import { LineupRail } from "@/components/wildcat/sales/lineup-rail";
import { CallCard } from "@/components/wildcat/sales/call-card";
import { TranscriptPanel } from "@/components/wildcat/sales/transcript-panel";
import {
  renderTemplate,
  WEEKDAYS,
  type CallStatus,
  type Prospect,
  type SalesConfig,
  type WeekdayKey,
} from "@/lib/wildcat/sales";

export function DeskView({
  prospects,
  config,
  onChange,
}: {
  prospects: Prospect[];
  config: SalesConfig;
  onChange: Dispatch<SetStateAction<Prospect[]>>;
}) {
  const [day, setDay] = useState<WeekdayKey>("mon");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(true);

  const lineup = useMemo(
    () => prospects.filter((p) => p.day === day),
    [prospects, day]
  );

  // Resolve the active prospect, defaulting to the top of the lineup.
  const current = lineup.find((p) => p.id === currentId) ?? lineup[0] ?? null;
  const currentIndex = current ? lineup.findIndex((p) => p.id === current.id) : -1;

  const goTo = useCallback(
    (index: number) => {
      const next = lineup[index];
      if (next) setCurrentId(next.id);
    },
    [lineup]
  );

  const handleStatusChange = useCallback(
    (status: CallStatus) => {
      if (!current) return;
      onChange((prev) =>
        prev.map((p) => (p.id === current.id ? { ...p, status } : p))
      );
    },
    [current, onChange]
  );

  // Reorder within the day's lineup (drag in the rail).
  const handleReorder = useCallback(
    (dragId: string, targetId: string, placeAfter: boolean) => {
      onChange((prev) => {
        const dragged = prev.find((p) => p.id === dragId);
        if (!dragged) return prev;
        const without = prev.filter((p) => p.id !== dragId);
        const targetIdx = without.findIndex((p) => p.id === targetId);
        if (targetIdx === -1) return prev;
        const insertAt = placeAfter ? targetIdx + 1 : targetIdx;
        return [
          ...without.slice(0, insertAt),
          dragged,
          ...without.slice(insertAt),
        ];
      });
    },
    [onChange]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Segmented
          options={WEEKDAYS.map((d) => ({ value: d.key, label: d.short }))}
          value={day}
          onChange={(v) => {
            setDay(v);
            setCurrentId(null);
          }}
        />
        <p className="text-xs text-muted-foreground">
          {lineup.length > 0 ? (
            <>
              Call{" "}
              <span className="font-medium text-foreground tabular-nums">
                {currentIndex + 1}
              </span>{" "}
              of <span className="tabular-nums">{lineup.length}</span>
            </>
          ) : (
            "No calls queued"
          )}
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous call"
            disabled={currentIndex <= 0}
            onClick={() => goTo(currentIndex - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next call"
            disabled={currentIndex < 0 || currentIndex >= lineup.length - 1}
            onClick={() => goTo(currentIndex + 1)}
          >
            <ChevronRightIcon />
          </Button>
          <Button size="sm" disabled={!current}>
            <PhoneCallIcon />
            Dial
          </Button>
        </div>
      </div>

      {current ? (
        <DndProvider backend={HTML5Backend}>
          <div className="flex min-h-0 flex-1 gap-3">
            <LineupRail
              lineup={lineup}
              currentId={current.id}
              onPick={setCurrentId}
              onReorder={handleReorder}
            />
            <CallCard
              prospect={current}
              script={renderTemplate(config.openingScript, current)}
              objections={config.objections}
              followUps={config.followUps}
              onStatusChange={handleStatusChange}
              onLogNext={() => goTo(currentIndex + 1)}
            />
            <TranscriptPanel
              lines={current.transcript}
              open={transcriptOpen}
              onToggle={() => setTranscriptOpen((v) => !v)}
            />
          </div>
        </DndProvider>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          Nothing queued for {WEEKDAYS.find((d) => d.key === day)?.label}.
        </div>
      )}
    </div>
  );
}
