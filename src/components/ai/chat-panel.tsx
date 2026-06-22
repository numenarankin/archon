"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SendIcon, XIcon } from "lucide-react";
import { SparkleIcon } from "@/components/ai/sparkle-icon";
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
import { ApprovalCard, pendingApprovals } from "@/components/ai/tool-approval";
import {
  refreshProjectMemory,
  saveMessages,
} from "@/lib/ai/conversation-actions";
import { useAiContext } from "@/lib/ai/use-ai-context";
import { buildPageContext } from "@/lib/ai/page-context";

/** Concatenate the text parts of a UIMessage. */
function messageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

interface ChatPanelProps {
  onClose?: () => void;
  /** When set, the chat is scoped to a project. */
  folderId?: string;
  projectName?: string;
  /**
   * Controlled active conversation id. When the parent switches conversations
   * (e.g. picking one from the history dropdown) it should also remount this
   * panel with a matching `key` so the chat state resets cleanly.
   */
  conversationId?: string;
  /** Messages to rehydrate a previously saved conversation. */
  initialMessages?: UIMessage[];
  /** Fired after a debounced save so the parent can refresh its history list. */
  onSaved?: () => void;
}

/**
 * Live chat panel backed by the AI SDK (`/api/chat` → Claude). Streams the
 * assistant's response token-by-token. Requires ANTHROPIC_API_KEY in the
 * environment for the route to authenticate. When `folderId` is set the chat is
 * scoped to that project (folder-scoped retrieval + page prompt).
 */
export function ChatPanel({
  onClose,
  folderId,
  projectName,
  conversationId,
  initialMessages,
  onSaved,
}: ChatPanelProps) {
  // Ground the assistant in the user's current location + selected file/folder
  // so it can resolve "this page" / "this file" references. `useChat` captures
  // the transport once (it only recreates on chat-id change), so we read the
  // route + selection *live* at send-time via the transport's function `body`
  // (re-resolved on every request, including tool-approval auto-resends) rather
  // than baking a snapshot in. folderId/projectName are stable per mount.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          ...(folderId ? { folderId, projectName } : {}),
          pageContext: buildPageContext(
            window.location.pathname,
            useAiContext.getState().selection
          ),
        }),
      }),
    [folderId, projectName]
  );
  // A draft conversation id so this chat is saved into chat history (persisted
  // on first message, see effect below). When the parent supplies an id (an
  // existing conversation), use that instead.
  const [generatedId] = useState(() => crypto.randomUUID());
  const activeId = conversationId ?? generatedId;
  // Throttle UI updates so the streamed markdown repaints on a smooth, steady
  // cadence instead of thrashing on every token.
  const { messages, sendMessage, status, error, addToolApprovalResponse } =
    useChat({
      id: activeId,
      messages: initialMessages,
      transport,
      experimental_throttle: 50,
      // Resume automatically once the user has approved/denied pending writes.
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    });
  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Skip the first effect run so rehydrating a saved chat doesn't immediately
  // re-save it (and ping onSaved) before the user has changed anything.
  const seededRef = useRef(true);
  // Track status transitions so we can finalize exactly once per assistant turn.
  const prevStatusRef = useRef(status);

  const isBusy = status === "submitted" || status === "streaming";

  // Persist chats into Supabase chat history (debounced; only once there is
  // content, so empty opens never create rows). Tags the conversation with the
  // folder so it shows up in this project's history.
  useEffect(() => {
    if (seededRef.current) {
      seededRef.current = false;
      return;
    }
    if (messages.length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMessages(activeId, messages, folderId)
        .then(() => onSaved?.())
        .catch((err) => console.error("Failed to save chat", err));
    }, 800);
  }, [messages, activeId, folderId, onSaved]);

  // When an assistant turn completes inside a project, finalize: flush the save
  // immediately (beat the debounce) and regenerate the project's curated memory
  // so the agent carries this turn forward. Folder-scoped only — the global /
  // drawer chats don't have project memory.
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    const justFinished =
      (prev === "streaming" || prev === "submitted") && status === "ready";
    if (!justFinished || !folderId || messages.length === 0) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    (async () => {
      try {
        await saveMessages(activeId, messages, folderId);
        onSaved?.();
        await refreshProjectMemory(folderId);
      } catch (err) {
        console.error("Failed to finalize project chat turn", err);
      }
    })();
  }, [status, folderId, activeId, messages, onSaved]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isBusy]);

  // Grow the input with its content (up to a max) and shrink back when cleared.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`;
  }, [input]);

  function handleSend() {
    const text = input.trim();
    if (!text || isBusy) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background-surface">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SparkleIcon className="size-4 text-data-accent" />
        <span className="ty-body-1 font-medium text-primary-text">Archon</span>
        <span className="ty-caption rounded-full bg-background-subtle px-1.5 py-0.5 text-tertiary-text">
          AI
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

      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex justify-start">
              <div className="ty-body-2 max-w-[85%] rounded-2xl bg-background-subtle px-3.5 py-2 text-primary-text">
                Hi, I&apos;m <strong>Archon</strong>. Ask me about anything in
                this folder, or across the company.
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className="flex flex-col gap-2">
              <MessageBubble role={m.role} text={messageText(m)} />
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

          {status === "submitted" && (
            <div className="ty-body-2 text-tertiary-text">Archon is thinking…</div>
          )}

          {error && (
            <div className="ty-body-2 rounded-lg bg-error/10 px-3 py-2 text-error">
              Something went wrong. Check that ANTHROPIC_API_KEY is set, then try
              again.
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border p-3">
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
            placeholder="Ask Archon…"
            className="ty-body-2 max-h-52 min-h-[3rem] flex-1 resize-none bg-transparent text-primary-text outline-none placeholder:text-tertiary-text"
          />
          <Button
            type="button"
            size="icon-sm"
            onClick={handleSend}
            disabled={!input.trim() || isBusy}
            aria-label="Send"
          >
            <SendIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ role, text }: { role: string; text: string }) {
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
