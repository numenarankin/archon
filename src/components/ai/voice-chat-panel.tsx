"use client";

import { useEffect, useRef, useState } from "react";
import { SendIcon, XIcon } from "lucide-react";
import { SparkleIcon } from "@/components/ai/sparkle-icon";
import { Button } from "@/components/ui/button";
import { useVoiceMode } from "@/lib/ai/use-voice-mode";
import { useVoiceConversation } from "@/lib/ai/use-voice-conversation";
import { VoiceBubble, VoiceStatusPill } from "@/components/ai/voice-chat-ui";
import { ApprovalCard } from "@/components/ai/tool-approval";

interface VoiceChatPanelProps {
  onClose?: () => void;
}

/**
 * Drawer-sized Archon chat in voice mode — the {@link ChatPanel} counterpart for
 * hands-free use. Same header + composer chrome as the typed drawer, but driven
 * by the shared voice loop: speak or type, and Archon replies out loud and on
 * screen. Self-persists into chat history like a normal drawer chat.
 */
export function VoiceChatPanel({ onClose }: VoiceChatPanelProps) {
  const setEnabled = useVoiceMode((s) => s.setEnabled);
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
    onEnd: () => setEnabled(false),
  });

  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="flex h-full min-h-0 flex-col bg-background-surface">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SparkleIcon className="size-4 text-data-accent" />
        <span className="ty-body-1 font-medium text-primary-text">Archon</span>
        <span className="ty-caption rounded-full bg-background-subtle px-1.5 py-0.5 text-tertiary-text">
          Voice
        </span>
        {onClose && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Close Archon"
            onClick={onClose}
            className="ml-auto"
          >
            <XIcon />
          </Button>
        )}
      </header>

      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="flex flex-col gap-4">
          {turns.length === 0 && !liveActive && (
            <div className="flex justify-start">
              <div className="ty-body-2 max-w-[85%] rounded-2xl bg-background-subtle px-3.5 py-2 text-primary-text">
                Voice mode is on — just start talking, or type below. I&apos;ll
                answer out loud and on screen. Talk over me to interrupt.
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

      <div className="shrink-0 border-t border-border p-3">
        <div className="mb-1.5 flex items-center px-1">
          <VoiceStatusPill status={status} />
        </div>
        <div className="flex items-end gap-2 rounded-lg border border-border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
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
            rows={2}
            placeholder="Speak, or type a message…"
            className="ty-body-2 max-h-52 min-h-[3rem] flex-1 resize-none bg-transparent text-primary-text outline-none placeholder:text-tertiary-text"
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
  );
}
