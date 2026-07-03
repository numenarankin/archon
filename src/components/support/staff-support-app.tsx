"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LifeBuoyIcon, PaperclipIcon, SendHorizontalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  markStaffThreadRead,
  refreshStaffThreads,
  sendStaffReply,
} from "@/lib/support/staff-actions";
import type { SupportMessage, SupportThread } from "@/lib/support/types";

const POLL_MS = 8000;

/** Newest-activity-first ordering, matching the server query. */
function byActivity(a: SupportThread, b: SupportThread): number {
  return b.lastMessageAt - a.lastMessageAt;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.round(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.round(hr / 24)}d`;
}

export function StaffSupportApp({
  initialThreads,
  configured,
}: {
  initialThreads: SupportThread[];
  configured: boolean;
}) {
  const [threads, setThreads] = useState<SupportThread[]>(
    [...initialThreads].sort(byActivity)
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialThreads[0]?.id ?? null
  );

  const selected = threads.find((t) => t.id === selectedId) ?? null;

  // Poll the inbox (staff can't hold a service-role realtime subscription against
  // the webapp project). Preserve the open thread's local optimistic messages if
  // the poll hasn't caught up yet.
  const merge = useCallback((incoming: SupportThread[]) => {
    setThreads((prev) => {
      const prevById = new Map(prev.map((t) => [t.id, t]));
      const next = incoming.map((t) => {
        const local = prevById.get(t.id);
        // Keep whichever side has more messages (optimistic sends not yet echoed).
        if (local && local.messages.length > t.messages.length) return local;
        return t;
      });
      return next.sort(byActivity);
    });
  }, []);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    const tick = async () => {
      try {
        const fresh = await refreshStaffThreads();
        if (alive) merge(fresh);
      } catch (error) {
        console.error("refreshStaffThreads failed", error);
      }
    };
    const id = setInterval(tick, POLL_MS);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [configured, merge]);

  function openThread(id: string) {
    setSelectedId(id);
    const t = threads.find((x) => x.id === id);
    if (t?.unread) {
      setThreads((prev) =>
        prev.map((x) => (x.id === id ? { ...x, unread: false } : x))
      );
      markStaffThreadRead(id).catch((e) =>
        console.error("markStaffThreadRead failed", e)
      );
    }
  }

  function appendLocal(threadId: string, message: SupportMessage) {
    setThreads((prev) =>
      prev
        .map((t) =>
          t.id === threadId
            ? {
                ...t,
                messages: [...t.messages, message],
                lastMessageAt: message.createdAt,
                unread: false,
              }
            : t
        )
        .sort(byActivity)
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      {!configured && (
        <div className="shrink-0 border-b bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Support backend not connected. Set{" "}
          <code className="font-mono">WEBAPP_SUPABASE_URL</code> and{" "}
          <code className="font-mono">WEBAPP_SUPABASE_SECRET_KEY</code> to read
          and reply to live threads.
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ThreadList
          threads={threads}
          selectedId={selectedId}
          onSelect={openThread}
        />
        <Conversation
          key={selected?.id ?? "none"}
          thread={selected}
          onSent={appendLocal}
        />
      </div>
    </div>
  );
}

function ThreadList({
  threads,
  selectedId,
  onSelect,
}: {
  threads: SupportThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex w-80 shrink-0 flex-col border-r bg-background">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4 text-sm font-medium">
        <LifeBuoyIcon className="size-4 text-muted-foreground" />
        Support
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No support requests yet.
          </p>
        )}
        {threads.map((t) => {
          const last = t.messages[t.messages.length - 1];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={cn(
                "flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left hover:bg-muted/50",
                selectedId === t.id && "bg-muted"
              )}
            >
              <div className="flex items-center gap-2">
                {t.unread && (
                  <span className="size-2 shrink-0 rounded-full bg-primary" />
                )}
                <span className="truncate text-sm font-medium">
                  {t.requester.name || t.requester.email || "Unknown user"}
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {relativeTime(t.lastMessageAt)}
                </span>
              </div>
              <span className="truncate text-xs text-muted-foreground">
                {t.subject}
              </span>
              {last && (
                <span className="truncate text-xs text-muted-foreground/80">
                  {last.senderRole === "staff" ? "You: " : ""}
                  {last.body || (last.attachments.length ? "📎 attachment" : "")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Conversation({
  thread,
  onSent,
}: {
  thread: SupportThread | null;
  onSent: (threadId: string, message: SupportMessage) => void;
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.messages, sending]);

  if (!thread) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Select a request to view the conversation.
      </div>
    );
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !thread) return;
    setSending(true);
    setInput("");
    try {
      const { id, createdAt } = await sendStaffReply(thread.id, text);
      onSent(thread.id, {
        id,
        threadId: thread.id,
        senderRole: "staff",
        body: text,
        createdAt,
        attachments: [],
      });
    } catch (error) {
      console.error("sendStaffReply failed", error);
      setInput(text); // restore the draft
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-background">
      <div className="flex h-11 shrink-0 flex-col justify-center border-b px-4">
        <span className="truncate text-sm font-medium">
          {thread.requester.name || "Unknown user"}
        </span>
        {thread.requester.email && (
          <span className="truncate text-xs text-muted-foreground">
            {thread.requester.email}
          </span>
        )}
      </div>

      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-28">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {thread.messages.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-4">
        <div className="pointer-events-auto mx-auto flex w-full max-w-3xl items-end gap-2 rounded-lg border bg-background px-3 py-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Reply to the customer…"
            className="max-h-52 min-h-[2.25rem] flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="button"
            size="icon-sm"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            aria-label="Send reply"
          >
            <SendHorizontalIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: SupportMessage }) {
  const isStaff = message.senderRole === "staff";
  return (
    <div className={cn("flex flex-col gap-1.5", isStaff ? "items-end" : "items-start")}>
      {message.attachments.length > 0 && (
        <div className={cn("flex max-w-[85%] flex-wrap gap-1.5", isStaff && "justify-end")}>
          {message.attachments.map((a) => (
            <a
              key={a.id}
              href={a.url ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted"
            >
              <PaperclipIcon className="size-3.5 text-muted-foreground" />
              <span className="max-w-[180px] truncate">{a.name}</span>
            </a>
          ))}
        </div>
      )}
      {message.body && (
        <div
          className={cn(
            "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap",
            isStaff
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          )}
        >
          {message.body}
        </div>
      )}
    </div>
  );
}
