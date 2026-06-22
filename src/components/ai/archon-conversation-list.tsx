"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/lib/ai/conversations";

interface ArchonConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

/**
 * Left-edge history rail for the Archon page: a "New chat" action over a
 * scrollable, most-recently-updated-first list of saved conversations.
 */
export function ArchonConversationList({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
}: ArchonConversationListProps) {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex h-full min-h-0 w-72 shrink-0 flex-col border-r border-border bg-background-surface">
      <div className="shrink-0 border-b border-border p-2">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={onCreate}
        >
          <PlusIcon className="size-4" />
          New chat
        </Button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-2">
        {sorted.length === 0 ? (
          <p className="ty-caption px-2 py-4 text-tertiary-text">
            No conversations yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sorted.map((c) => {
              const active = c.id === activeId;
              return (
                <li key={c.id}>
                  <div
                    className={cn(
                      "group flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors",
                      active
                        ? "bg-background-subtle"
                        : "hover:bg-background-subtle/60"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      className={cn(
                        "ty-body-2 min-w-0 flex-1 truncate text-left",
                        active ? "text-primary-text" : "text-secondary-text"
                      )}
                      title={c.title}
                    >
                      {c.title}
                    </button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Delete conversation"
                      onClick={() => onDelete(c.id)}
                      className="size-6 shrink-0 text-tertiary-text opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </div>
  );
}
