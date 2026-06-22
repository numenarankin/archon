"use client";

import { MicIcon, Loader2Icon, AudioLinesIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { VoiceStatus } from "@/lib/ai/use-voice-conversation";

/** Human-readable status text shared by every voice surface. */
export function voiceStatusLabel(status: VoiceStatus): string {
  switch (status) {
    case "listening":
      return "Listening…";
    case "thinking":
      return "Archon is thinking…";
    case "speaking":
      return "Archon is speaking — talk to interrupt";
    default:
      return "Starting…";
  }
}

/** Mic/spinner/wave icon + label reflecting the live voice phase. */
export function VoiceStatusPill({ status }: { status: VoiceStatus }) {
  return (
    <span className="ty-caption flex items-center gap-1.5 font-medium text-tertiary-text">
      {status === "thinking" ? (
        <Loader2Icon className="size-3.5 animate-spin text-data-accent" />
      ) : status === "speaking" ? (
        <AudioLinesIcon className="size-3.5 text-data-accent" />
      ) : (
        <span className="relative flex size-3.5 items-center justify-center">
          <span
            className={cn(
              "absolute inline-flex size-full rounded-full bg-data-accent/40",
              status === "listening" && "animate-ping"
            )}
          />
          <MicIcon className="size-3 text-data-accent" />
        </span>
      )}
      {voiceStatusLabel(status)}
    </span>
  );
}

/** A single chat bubble for a plain-text voice turn. */
export function VoiceBubble({
  role,
  text,
}: {
  role: "user" | "assistant";
  text: string;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-background-subtle text-primary-text"
        )}
      >
        <div className="ty-body-2 prose-chat">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
