"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SendIcon,
  PlusIcon,
  PaperclipIcon,
  XIcon,
  FileTextIcon,
  Volume2Icon,
  SquareIcon,
  Loader2Icon,
  CopyIcon,
  CheckIcon,
} from "lucide-react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AddFileDialog } from "@/components/projects/add-file-dialog";
import { ApprovalCard, pendingApprovals } from "@/components/ai/tool-approval";
import { useSpeech, type SpeechState } from "@/components/ai/use-speech";
import type { Conversation } from "@/lib/ai/conversations";
import type { KBFile } from "@/lib/kb/types";

/** Concatenate the text parts of a UIMessage. */
function messageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/** Flatten markdown to plain prose so the voice doesn't read syntax aloud. */
function stripMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → label
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^\s*[-*+]\s+/gm, "") // bullets
    .replace(/[*_~]+/g, "") // emphasis marks
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Names of tools invoked in a message (static `tool-<name>` + dynamic). */
function toolCallNames(message: UIMessage | undefined): string[] {
  if (!message) return [];
  const names: string[] = [];
  for (const part of message.parts) {
    if (typeof part.type === "string" && part.type.startsWith("tool-")) {
      names.push(part.type.slice("tool-".length));
    } else if (part.type === "dynamic-tool") {
      const name = (part as { toolName?: string }).toolName;
      if (name) names.push(name);
    }
  }
  return names;
}

/** Whether a message has any visible streamed text yet. */
function hasText(message: UIMessage | undefined): boolean {
  return Boolean(message && messageText(message).trim().length > 0);
}

interface DisplayAttachment {
  kind: "kb" | "disk";
  name: string;
}

/**
 * Split a message into display text + attachment chips: disk uploads come
 * through as `file` parts, knowledge-base attachments as a trailing text marker.
 */
function splitAttachments(message: UIMessage): {
  text: string;
  attachments: DisplayAttachment[];
} {
  const attachments: DisplayAttachment[] = [];

  let text = messageText(message);
  const marker = text.match(/\n*\[Attached from knowledge base: ([^\]]*)\]\s*$/);
  if (marker) {
    text = text.slice(0, marker.index).trimEnd();
    for (const name of marker[1].split(",")) {
      const trimmed = name.trim();
      if (trimmed) attachments.push({ kind: "kb", name: trimmed });
    }
  }

  for (const part of message.parts) {
    if (part.type === "file") {
      const filePart = part as { filename?: string };
      attachments.push({ kind: "disk", name: filePart.filename ?? "file" });
    }
  }

  return { text, attachments };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type Attachment =
  | { kind: "kb"; key: string; refId: string; name: string }
  | { kind: "disk"; key: string; file: File };

interface ArchonChatProps {
  conversation: Conversation;
  /** Persist the live message list back to the conversation store. */
  onMessagesChange: (messages: UIMessage[]) => void;
}

/**
 * Full-page Archon chat surface backed by the AI SDK (`/api/chat` → Claude).
 * Supports attaching files from the knowledge base (plus) or uploading from
 * disk (paperclip). Disk files are sent to Claude as file parts; knowledge-base
 * attachments are referenced by name (prototype — no stored content yet).
 */
export function ArchonChat({ conversation, onMessagesChange }: ArchonChatProps) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );
  const { messages, sendMessage, status, error, addToolApprovalResponse } =
    useChat({
      id: conversation.id,
      messages: conversation.messages,
      transport,
      experimental_throttle: 50,
      // Once the user has approved/denied every pending write tool, resume the
      // run automatically so the approved action executes (or Archon is told it
      // was declined).
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    });
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [kbOpen, setKbOpen] = useState(false);
  const speech = useSpeech();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const diskInputRef = useRef<HTMLInputElement>(null);
  const diskIdRef = useRef(0);

  const isBusy = status === "submitted" || status === "streaming";

  // While Archon works (before its answer text streams), surface which tools it's
  // calling. The in-progress assistant message is the last one.
  const lastMessage = messages[messages.length - 1];
  const inProgress = lastMessage?.role === "assistant" ? lastMessage : undefined;
  const activeTools = isBusy ? toolCallNames(inProgress) : [];
  const showThinking = isBusy && !hasText(inProgress);

  const seededRef = useRef(true);
  useEffect(() => {
    if (seededRef.current) {
      seededRef.current = false;
      return;
    }
    onMessagesChange(messages);
  }, [messages, onMessagesChange]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isBusy]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`;
  }, [input]);

  const kbAttachedIds = new Set(
    attachments.filter((a) => a.kind === "kb").map((a) => a.refId)
  );

  function addKbFiles(files: KBFile[]) {
    setAttachments((prev) => {
      const have = new Set(
        prev.filter((a) => a.kind === "kb").map((a) => a.refId)
      );
      const next = files
        .filter((f) => !have.has(f.id))
        .map((f) => ({
          kind: "kb" as const,
          key: `kb-${f.id}`,
          refId: f.id,
          name: f.name,
        }));
      return [...prev, ...next];
    });
  }

  function addDiskFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const next = Array.from(list).map((file) => ({
      kind: "disk" as const,
      key: `disk-${diskIdRef.current++}`,
      file,
    }));
    setAttachments((prev) => [...prev, ...next]);
  }

  function removeAttachment(key: string) {
    setAttachments((prev) => prev.filter((a) => a.key !== key));
  }

  async function handleSend() {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isBusy) return;

    const disk = attachments.filter(
      (a): a is Extract<Attachment, { kind: "disk" }> => a.kind === "disk"
    );
    const kb = attachments.filter(
      (a): a is Extract<Attachment, { kind: "kb" }> => a.kind === "kb"
    );

    const fileParts = await Promise.all(
      disk.map(async (d) => ({
        type: "file" as const,
        mediaType: d.file.type || "application/octet-stream",
        filename: d.file.name,
        url: await fileToDataUrl(d.file),
      }))
    );

    let finalText = text;
    if (kb.length > 0) {
      const list = kb.map((k) => k.name).join(", ");
      finalText = `${text}\n\n[Attached from knowledge base: ${list}]`.trim();
    }

    sendMessage({
      text: finalText,
      files: fileParts.length > 0 ? fileParts : undefined,
    });
    setInput("");
    setAttachments([]);
  }

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isBusy;

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-background-surface">
      {/* Full-height scroll area — history scrolls underneath the floating
          composer, including into the small padding gap below it. */}
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-28"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex justify-start">
              <div className="ty-body-2 max-w-[85%] rounded-2xl bg-background-subtle px-3.5 py-2 text-primary-text">
                Hi, I&apos;m <strong>Archon</strong>. Ask me anything about
                running the company.
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className="flex flex-col gap-2">
              <MessageBubble
                role={m.role}
                message={m}
                speech={
                  m.role === "assistant" && hasText(m)
                    ? {
                        state:
                          speech.activeId === m.id ? speech.state : "idle",
                        onToggle: (text) => speech.toggle(m.id, text),
                      }
                    : undefined
                }
              />
              {pendingApprovals(m).map((req) => (
                <ApprovalCard
                  key={req.id}
                  request={req}
                  onApprove={() =>
                    addToolApprovalResponse({ id: req.id, approved: true })
                  }
                  onDeny={() =>
                    addToolApprovalResponse({ id: req.id, approved: false })
                  }
                />
              ))}
            </div>
          ))}

          {showThinking && (
            <div className="ty-body-2 text-tertiary-text">
              Archon is thinking…
              {activeTools.length > 0 && (
                <div className="mt-1 flex flex-col gap-0.5">
                  {activeTools.map((name, i) => (
                    <span
                      key={`${name}-${i}`}
                      className="font-mono text-xs text-tertiary-text/80"
                    >
                      → {name}()
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="ty-body-2 rounded-lg bg-error/10 px-3 py-2 text-error">
              Something went wrong. Check that ANTHROPIC_API_KEY is set, then try
              again.
            </div>
          )}
        </div>
      </div>

      {/* Composer floats at the bottom; pb leaves a small gap below it through
          which the scrolling history stays visible. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-4">
        <div className="pointer-events-auto mx-auto w-full max-w-3xl rounded-lg border border-border bg-background px-3 py-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((a) => (
                <span
                  key={a.key}
                  className="ty-caption flex items-center gap-1 rounded-md bg-background-subtle py-1 pl-2 pr-1 text-primary-text"
                >
                  {a.kind === "kb" ? (
                    <FileTextIcon className="size-3.5 text-tertiary-text" />
                  ) : (
                    <PaperclipIcon className="size-3.5 text-tertiary-text" />
                  )}
                  <span className="max-w-[180px] truncate">
                    {a.kind === "kb" ? a.name : a.file.name}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove attachment"
                    onClick={() => removeAttachment(a.key)}
                    className="rounded p-0.5 text-tertiary-text hover:bg-background-hover hover:text-primary-text"
                  >
                    <XIcon className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

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
              placeholder="Ask Archon…"
              className="ty-body-2 max-h-52 min-h-[2.25rem] flex-1 resize-none bg-transparent py-1 text-primary-text outline-none placeholder:text-tertiary-text"
            />
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Attach from knowledge base"
                onClick={() => setKbOpen(true)}
              >
                <PlusIcon />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Upload from disk"
                onClick={() => diskInputRef.current?.click()}
              >
                <PaperclipIcon />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                onClick={handleSend}
                disabled={!canSend}
                aria-label="Send"
              >
                <SendIcon />
              </Button>
            </div>
          </div>

          <input
            ref={diskInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addDiskFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <AddFileDialog
        open={kbOpen}
        onOpenChange={setKbOpen}
        existingIds={kbAttachedIds}
        onAdd={addKbFiles}
      />
    </div>
  );
}

interface SpeechControl {
  state: SpeechState;
  onToggle: (text: string) => void;
}

function MessageBubble({
  role,
  message,
  speech,
}: {
  role: string;
  message: UIMessage;
  speech?: SpeechControl;
}) {
  const isUser = role === "user";
  const { text, attachments } = splitAttachments(message);

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        isUser ? "items-end" : "items-start"
      )}
    >
      {attachments.length > 0 && (
        <div
          className={cn(
            "flex max-w-[85%] flex-wrap gap-1.5",
            isUser && "justify-end"
          )}
        >
          {attachments.map((a, i) => (
            <span
              key={i}
              className="ty-caption flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-primary-text"
            >
              {a.kind === "kb" ? (
                <FileTextIcon className="size-3.5 text-tertiary-text" />
              ) : (
                <PaperclipIcon className="size-3.5 text-tertiary-text" />
              )}
              <span className="max-w-[180px] truncate">{a.name}</span>
            </span>
          ))}
        </div>
      )}
      {text && (
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
      )}
      {!isUser && text && (
        <div className="flex items-center gap-0.5">
          <CopyButton text={stripMarkdown(text)} />
          {speech && (
            <ReadAloudButton
              state={speech.state}
              onToggle={() => speech.onToggle(stripMarkdown(text))}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Copy an assistant response to the clipboard, with a brief confirmation. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Copy failed", error);
    }
  }

  const label = copied ? "Copied" : "Copy";
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={label}
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-tertiary-text transition-colors hover:bg-background-hover hover:text-primary-text"
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-data-accent" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </button>
  );
}

/** Small play/stop control under an assistant message. */
function ReadAloudButton({
  state,
  onToggle,
}: {
  state: SpeechState;
  onToggle: () => void;
}) {
  const label =
    state === "playing"
      ? "Stop"
      : state === "loading"
        ? "Loading audio…"
        : "Read aloud";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-tertiary-text transition-colors hover:bg-background-hover hover:text-primary-text"
    >
      {state === "loading" ? (
        <Loader2Icon className="size-3.5 animate-spin" />
      ) : state === "playing" ? (
        <SquareIcon className="size-3.5 fill-current" />
      ) : (
        <Volume2Icon className="size-3.5" />
      )}
    </button>
  );
}
