"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { TranscriptLine } from "@/lib/wildcat/sales";

interface LineRow {
  speaker: "rep" | "prospect";
  text: string;
}

/**
 * Live transcript for an active call: loads existing `sales_call_lines` and
 * subscribes to inserts via Supabase Realtime. Returns [] when no call is
 * active. The Telnyx webhook writes the rows (see plans/telnyx_dialer.md).
 */
export function useCallTranscript(callId: string | null): TranscriptLine[] {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  // Clear synchronously when the call changes (adjust-state-during-render, not an
  // effect) so switching calls never briefly shows the previous transcript.
  const [forCall, setForCall] = useState<string | null>(callId);
  if (callId !== forCall) {
    setForCall(callId);
    setLines([]);
  }

  useEffect(() => {
    if (!callId) return;
    const sb = getSupabaseBrowser();
    let cancelled = false;

    void sb
      .from("sales_call_lines")
      .select("speaker, text, seq")
      .eq("call_id", callId)
      .order("seq", { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setLines(
          (data as LineRow[]).map((r) => ({ speaker: r.speaker, text: r.text }))
        );
      });

    const channel = sb
      .channel(`sales-call-${callId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sales_call_lines",
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          const r = payload.new as LineRow;
          setLines((prev) => [...prev, { speaker: r.speaker, text: r.text }]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void sb.removeChannel(channel);
    };
  }, [callId]);

  return lines;
}
