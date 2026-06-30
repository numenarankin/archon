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
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MicOffIcon,
  PhoneCallIcon,
  PhoneOffIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/numena/kpis/segmented";
import { LineupRail } from "@/components/wildcat/sales/lineup-rail";
import { CallCard } from "@/components/wildcat/sales/call-card";
import { TranscriptPanel } from "@/components/wildcat/sales/transcript-panel";
import { useTelnyxDialer } from "@/components/wildcat/sales/use-telnyx-dialer";
import { useCallTranscript } from "@/components/wildcat/sales/use-call-transcript";
import {
  renderTemplate,
  WEEKDAYS,
  type CallStatus,
  type Prospect,
  type SalesConfig,
  type WeekdayKey,
} from "@/lib/wildcat/sales";
import { logCall, updateProspectStatus } from "@/lib/wildcat/sales-actions";

export function DeskView({
  prospects,
  config,
  onChange,
  onPersistQueue,
  telephonyEnabled = false,
}: {
  prospects: Prospect[];
  config: SalesConfig;
  onChange: Dispatch<SetStateAction<Prospect[]>>;
  /** Persist the lineup order after a rail drag. */
  onPersistQueue?: () => void;
  /** Whether Telnyx is configured on the server (enables the live dialer). */
  telephonyEnabled?: boolean;
}) {
  const {
    state: callState,
    muted: dialMuted,
    error: dialError,
    callId: liveCallId,
    audioRef,
    dial,
    hangup,
    toggleMute,
  } = useTelnyxDialer();
  const [day, setDay] = useState<WeekdayKey>("unscheduled");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  // Notes for the active call, reset when the active prospect changes.
  const [notes, setNotes] = useState("");
  const [notesFor, setNotesFor] = useState<string | null>(null);

  const lineup = useMemo(
    () => prospects.filter((p) => p.day === day),
    [prospects, day]
  );

  // Resolve the active prospect, defaulting to the top of the lineup.
  const current = lineup.find((p) => p.id === currentId) ?? lineup[0] ?? null;
  const currentIndex = current ? lineup.findIndex((p) => p.id === current.id) : -1;

  // Clear the notepad when moving to a different prospect (render-time adjust).
  if (current && current.id !== notesFor) {
    setNotesFor(current.id);
    setNotes("");
  }

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
      updateProspectStatus(current.id, status).catch((e) =>
        console.error("Failed to save status", e)
      );
    },
    [current, onChange]
  );

  // "Log & next": persist the call (outcome + notes + transcript), mark the
  // prospect called, then advance. Defaults a still-"new" call to no-answer.
  const handleLogNext = useCallback(() => {
    if (!current) return;
    const outcome: CallStatus = current.status === "new" ? "no_answer" : current.status;
    onChange((prev) =>
      prev.map((p) => (p.id === current.id ? { ...p, status: outcome } : p))
    );
    logCall({
      prospectId: current.id,
      status: outcome,
      notes,
      durationSeconds: 0,
      transcript: current.transcript,
    }).catch((e) => console.error("Failed to log call", e));
    setNotes("");
    goTo(currentIndex + 1);
  }, [current, notes, onChange, currentIndex, goTo]);

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

  // While a call is live, the transcript comes from Supabase Realtime; otherwise
  // show whatever the prospect record carries (empty for a fresh DB prospect).
  const onCall =
    liveCallId !== null && (callState === "ringing" || callState === "active");
  const liveLines = useCallTranscript(onCall ? liveCallId : null);
  const dialing = callState === "connecting";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <audio ref={audioRef} autoPlay hidden />
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
          {onCall ? (
            <>
              <Button
                variant="outline"
                size="sm"
                aria-pressed={dialMuted}
                onClick={toggleMute}
              >
                <MicOffIcon />
                {dialMuted ? "Unmute" : "Mute"}
              </Button>
              <Button variant="destructive" size="sm" onClick={hangup}>
                <PhoneOffIcon />
                Hang up
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              disabled={!current || !telephonyEnabled || dialing}
              title={telephonyEnabled ? undefined : "Telnyx is not configured"}
              onClick={() =>
                current && dial({ id: current.id, phone: current.phone })
              }
            >
              <PhoneCallIcon />
              {dialing ? "Connecting…" : "Dial"}
            </Button>
          )}
        </div>
      </div>
      {dialError && (
        <p className="shrink-0 text-xs text-destructive">{dialError}</p>
      )}

      {current ? (
        <DndProvider backend={HTML5Backend}>
          <div className="flex min-h-0 flex-1 gap-3">
            <LineupRail
              lineup={lineup}
              currentId={current.id}
              onPick={setCurrentId}
              onReorder={handleReorder}
              onPersist={onPersistQueue}
            />
            <CallCard
              prospect={current}
              script={renderTemplate(config.openingScript, current)}
              objections={config.objections}
              followUps={config.followUps}
              notes={notes}
              onNotesChange={setNotes}
              onStatusChange={handleStatusChange}
              onLogNext={handleLogNext}
            />
            <TranscriptPanel
              lines={onCall ? liveLines : current.transcript}
              open={transcriptOpen}
              onToggle={() => setTranscriptOpen((v) => !v)}
              live={onCall}
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
