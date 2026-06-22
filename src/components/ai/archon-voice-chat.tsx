"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SendIcon } from "lucide-react";
import type { UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import { useVoiceMode } from "@/lib/ai/use-voice-mode";
import {
  useVoiceConversation,
  type VoiceTurn,
} from "@/lib/ai/use-voice-conversation";
import { VoiceBubble, VoiceStatusPill } from "@/components/ai/voice-chat-ui";
import { ApprovalCard } from "@/components/ai/tool-approval";
import type { Conversation } from "@/lib/ai/conversations";

/** Concatenate the text parts of a UIMessage. */
function messageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/** Project a stored conversation down to plain text turns for the voice loop. */
function toVoiceTurns(messages: UIMessage[]): VoiceTurn[] {
  const turns: VoiceTurn[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const text = messageText(m).trim();
    if (text) turns.push({ role: m.role, text });
  }
  return turns;
}

/** Back to UIMessages so the voice exchange persists into the open thread. */
function toMessages(turns: VoiceTurn[]): UIMessage[] {
  return turns.map((t, i) => ({
    id: `voice-${i}-${t.role}`,
    role: t.role,
    parts: [{ type: "text", text: t.text }],
  }));
}

interface ArchonVoiceChatProps {
  conversation: Conversation;
  /** Persist the live message list back to the conversation store. */
  onMessagesChange: (messages: UIMessage[]) => void;
}

/**
 * Full-page Archon chat in voice mode: the same chat surface as {@link ArchonChat}
 * but driven by the hands-free voice loop. The user can speak or type; Archon's
 * reply is both printed and spoken aloud. Seeds from and persists back into the
 * open conversation so the thread is continuous when voice is toggled on/off.
 */
export function ArchonVoiceChat({
  conversation,
  onMessagesChange,
}: ArchonVoiceChatProps) {
  const setEnabled = useVoiceMode((s) => s.setEnabled);
  // Snapshot the thread once, when voice mode mounts, as the loop's seed.
  const seedTurns = useMemo(
    () => toVoiceTurns(conversation.messages),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const {
    status,
    error,
    lastUser,
    liveReply,
    liveActive,
    turns,
    submitText,
    pendingApprovals,
    respondToApproval,
  } = useVoiceConversation({
    enabled: true,
    initialTurns: seedTurns,
    onCommit: (next) => onMessagesChange(toMessages(next)),
    onEnd: () => setEnabled(false),
  });

  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The provisional in-flight pair, rendered after committed turns.
  const liveUserText = liveActive ? lastUser : "";
  const liveReplyText = liveActive ? liveReply : "";

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, liveUserText, liveReplyText, status, pendingApprovals]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`;
  }, [input]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    submitText(text);
    setInput("");
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-background-surface">
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-28"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {turns.length === 0 && !liveActive && (
            <div className="flex justify-start">
              <div className="ty-body-2 max-w-[85%] rounded-2xl bg-background-subtle px-3.5 py-2 text-primary-text">
                Voice mode is on — just start talking, or type below. I&apos;ll
                answer out loud and on screen. Talk over me anytime to
                interrupt.
              </div>
            </div>
          )}

          {turns.map((t, i) => (
            <VoiceBubble key={`turn-${i}`} role={t.role} text={t.text} />
          ))}

          {liveUserText && <VoiceBubble role="user" text={liveUserText} />}
          {liveReplyText && (
            <VoiceBubble role="assistant" text={liveReplyText} />
          )}

          {pendingApprovals.map((req) => (
            <ApprovalCard
              key={req.id}
              request={req}
              onApprove={() => respondToApproval(req.id, true)}
              onDeny={() => respondToApproval(req.id, false)}
            />
          ))}

          {liveActive && status === "thinking" && !liveReplyText && (
            <div className="ty-body-2 text-tertiary-text">
              Archon is thinking…
            </div>
          )}

          {error && (
            <div className="ty-body-2 rounded-lg bg-error/10 px-3 py-2 text-error">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Composer floats at the bottom; the status pill shows the live mic
          state, mirroring the overlay so behavior reads the same. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-4">
        <div className="pointer-events-auto mx-auto w-full max-w-3xl rounded-lg border border-border bg-background px-3 py-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
          <div className="mb-1.5 flex items-center gap-2">
            <VoiceStatusPill status={status} />
          </div>
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder="Speak, or type a message…"
              className="ty-body-2 max-h-52 min-h-[2.25rem] flex-1 resize-none bg-transparent py-1 text-primary-text outline-none placeholder:text-tertiary-text"
            />
            <Button
              type="button"
              size="icon-sm"
              onClick={handleSend}
              disabled={input.trim().length === 0}
              aria-label="Send"
            >
              <SendIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
