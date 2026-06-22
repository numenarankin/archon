"use client";

import { useRef, useState, useTransition } from "react";
import {
  XIcon,
  SendIcon,
  Trash2Icon,
  PaperclipIcon,
  AlertCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SparkleIcon } from "@/components/ai/sparkle-icon";
import { sendMessage, draftReply } from "@/lib/email/actions";

export interface ComposeDraft {
  to: string;
  subject: string;
  body: string;
  /**
   * The message being replied to, when this is a reply. Gives Archon the
   * context to draft a response. Archon drafts only — it never sends.
   */
  original?: { from: string; subject: string; body: string };
}

/**
 * Gmail-style compose card that floats over the bottom-right of the message
 * pane, so the message being replied to stays visible above it.
 */
export function ComposeCard({
  initial,
  onClose,
}: {
  initial: ComposeDraft;
  onClose: () => void;
}) {
  const [to, setTo] = useState(initial.to);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [drafting, startDrafting] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAttachments((prev) => [...prev, ...Array.from(files).map((f) => f.name)]);
  }

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const result = await sendMessage({ to, subject, body });
      if (result.ok) {
        onClose();
      } else {
        setError(result.error ?? "Failed to send.");
      }
    });
  }

  // Ask Archon to draft the reply body. It only ever returns text — there is no
  // send path here — so the user always reviews and sends it themselves.
  function handleDraft() {
    setError(null);
    startDrafting(async () => {
      const result = await draftReply({
        original: initial.original,
        to,
        subject,
      });
      if (result.ok && result.draft) {
        setBody(result.draft);
      } else {
        setError(result.error ?? "Couldn't draft a reply.");
      }
    });
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 sm:px-6">
      <div className="pointer-events-auto flex h-[26rem] max-h-[calc(100%-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl border border-b-0 bg-background font-sans shadow-2xl">
        <div className="flex h-11 shrink-0 items-center justify-between rounded-t-xl border-b bg-muted/40 px-4">
          <span className="text-sm font-medium text-foreground">
            {subject.trim() ? subject : "New message"}
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4">
          <label className="flex items-center gap-2 border-b py-1.5">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">To</span>
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="name@example.com"
              className="h-7 border-0 px-0 text-sm focus-visible:ring-0"
            />
          </label>
          <label className="flex items-center gap-2 border-b py-1.5">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">
              Subject
            </span>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="h-7 border-0 px-0 text-sm focus-visible:ring-0"
            />
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message…"
            autoFocus
            className="mt-2 min-h-0 w-full flex-1 resize-none bg-transparent font-sans text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          />

          {attachments.length > 0 && (
            <ul className="flex shrink-0 flex-wrap gap-1.5 py-2">
              {attachments.map((name, i) => (
                <li
                  key={`${name}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 py-1 pl-2 pr-1 text-xs"
                >
                  <PaperclipIcon className="size-3 text-muted-foreground" />
                  <span className="max-w-40 truncate">{name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() =>
                      setAttachments((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <XIcon className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="flex items-center gap-2 py-2 text-xs text-destructive">
              <AlertCircleIcon className="size-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t px-4 py-2.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleDraft}
                  disabled={drafting || pending}
                >
                  <SparkleIcon className="size-4" />
                  {drafting ? "Drafting…" : "Draft with Archon"}
                </Button>
              }
            />
            <TooltipContent>
              Let Archon draft a reply (it never sends)
            </TooltipContent>
          </Tooltip>
          <div className="ml-auto flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Attach files"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={pending}
                  >
                    <PaperclipIcon className="text-muted-foreground" />
                  </Button>
                }
              />
              <TooltipContent>Attach files</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Discard draft"
                    onClick={onClose}
                    disabled={pending}
                  >
                    <Trash2Icon className="text-muted-foreground" />
                  </Button>
                }
              />
              <TooltipContent>Discard</TooltipContent>
            </Tooltip>
            <Button onClick={handleSend} disabled={pending} className="gap-1.5">
              <SendIcon />
              {pending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
