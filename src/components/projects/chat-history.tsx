"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ChevronRightIcon,
  MessageSquareIcon,
  PlusIcon,
  Loader2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFolderConversations } from "@/lib/ai/conversation-actions";
import type { Conversation } from "@/lib/ai/conversations";

interface ChatHistoryProps {
  folderId: string;
  /** The currently open conversation id (highlighted in the list). */
  activeId: string | null;
  /** Bump to force a reload (e.g. after a chat is saved). */
  refreshToken: number;
  onSelect: (conversation: Conversation) => void;
  onNewChat: () => void;
}

/**
 * Collapsible list of every Archon chat in this project. Lives under
 * the file tree; expanding it reveals the project's chat history, and picking
 * one rehydrates the chat panel.
 */
export function ChatHistory({
  folderId,
  activeId,
  refreshToken,
  onSelect,
  onNewChat,
}: ChatHistoryProps) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        setConversations(await getFolderConversations(folderId));
      } catch (error) {
        console.error("Failed to load chat history", error);
      }
    });
  }, [folderId, refreshToken]);

  return (
    <div className="shrink-0 border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left ty-body-2 font-medium text-primary-text transition-colors hover:bg-background-hover"
      >
        <ChevronRightIcon
          className={cn(
            "size-3.5 shrink-0 text-tertiary-text transition-transform",
            open && "rotate-90"
          )}
        />
        <MessageSquareIcon className="size-3.5 shrink-0 text-tertiary-text" />
        <span className="flex-1 truncate">Chat history</span>
        {loading ? (
          <Loader2Icon className="size-3.5 shrink-0 animate-spin text-tertiary-text" />
        ) : (
          <span className="ty-caption shrink-0 text-tertiary-text">
            {conversations.length}
          </span>
        )}
      </button>

      {open && (
        <div className="max-h-64 overflow-y-auto px-2 pb-2">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center gap-1.5 rounded-[3px] px-2 py-1.5 text-left ty-body-2 text-data-accent transition-colors hover:bg-background-hover"
          >
            <PlusIcon className="size-3.5 shrink-0" />
            New chat
          </button>

          {conversations.length === 0 && !loading && (
            <p className="px-2 py-2 ty-caption text-tertiary-text">
              No chats in this project yet.
            </p>
          )}

          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-[3px] px-2 py-1.5 text-left ty-body-2 transition-colors",
                c.id === activeId
                  ? "bg-data-accent/15 text-data-accent"
                  : "text-primary-text hover:bg-background-hover"
              )}
            >
              <MessageSquareIcon className="size-3.5 shrink-0 text-tertiary-text" />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
