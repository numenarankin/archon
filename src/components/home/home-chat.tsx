"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SendIcon,
  PlusIcon,
  PaperclipIcon,
  XIcon,
  FileTextIcon,
} from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AddFileDialog } from "@/components/projects/add-file-dialog";
import type { KBFile } from "@/lib/kb/types";

function messageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
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

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
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

/**
 * Home landing chat: a time-of-day greeting over a large composer, backed by
 * the AI SDK (`/api/chat` → Claude). A simplified Archon — no conversation
 * history sidebar. Once a message is sent the thread takes over the view.
 */
export function HomeChat({ firstName }: { firstName: string }) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );
  const { messages, sendMessage, status, error } = useChat({
    transport,
    experimental_throttle: 50,
  });
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [kbOpen, setKbOpen] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const diskInputRef = useRef<HTMLInputElement>(null);
  const diskIdRef = useRef(0);

  const isBusy = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;

  // Compute the greeting on the client to use local time (avoids SSR mismatch).
  useEffect(() => {
    setGreeting(timeOfDayGreeting());
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isBusy]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
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

  const composer = (
    <div className="w-full rounded-xl border border-foreground/20 bg-background px-3 py-2.5 focus-within:ring-1 focus-within:ring-ring">
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

      <textarea
        ref={textareaRef}
        autoFocus
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        rows={hasMessages ? 2 : 4}
        placeholder="How can I help you today?"
        className="ty-body-2 max-h-60 min-h-[2.5rem] w-full resize-none bg-transparent text-primary-text outline-none placeholder:text-tertiary-text"
      />

      <div className="flex items-center justify-end gap-0.5">
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
          className="ml-1"
        >
          <SendIcon />
        </Button>
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
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {hasMessages ? (
        <>
          <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto py-6">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              {messages.map((m) => (
                <MessageBubble key={m.id} role={m.role} message={m} />
              ))}
              {status === "submitted" && (
                <div className="ty-body-2 text-tertiary-text">
                  Archon is thinking…
                </div>
              )}
              {error && (
                <div className="ty-body-2 rounded-lg bg-error/10 px-3 py-2 text-error">
                  Something went wrong. Check that ANTHROPIC_API_KEY is set, then
                  try again.
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0 py-4">
            <div className="mx-auto w-full max-w-3xl">{composer}</div>
          </div>
        </>
      ) : (
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          {/* Decorative dot field, densest around the composer and fading out. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,_color-mix(in_oklch,_var(--foreground)_24%,_transparent)_1.25px,_transparent_1.75px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_58%_48%_at_50%_50%,_black,_transparent_78%)]"
          />
          {/* Composer is vertically centered; the greeting floats above it. */}
          <div className="relative flex w-full max-w-2xl flex-col items-center">
            <h1 className="absolute bottom-full mb-6 w-full text-center font-heading text-4xl font-medium tracking-tight">
              {greeting ?? "Welcome"}, {firstName}
            </h1>
            {composer}
          </div>
        </div>
      )}

      <AddFileDialog
        open={kbOpen}
        onOpenChange={setKbOpen}
        existingIds={kbAttachedIds}
        onAdd={addKbFiles}
      />
    </div>
  );
}

function MessageBubble({
  role,
  message,
}: {
  role: string;
  message: UIMessage;
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
    </div>
  );
}
