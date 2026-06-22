"use client";

import { useEffect } from "react";
import { Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SparkleIcon } from "@/components/ai/sparkle-icon";
import { Chat } from "@/components/agent-chat";
import { useAgentStore } from "@/store/agent-store";

export function AgentPanelTrigger() {
  const toggle = useAgentStore((s) => s.toggle);
  const isOpen = useAgentStore((s) => s.isOpen);
  return (
    <Button
      aria-label="Open Hermes"
      aria-pressed={isOpen}
      size="icon-sm"
      variant="outline"
      onClick={toggle}
    >
      <SparkleIcon className={cn(isOpen && "text-[#0072f5]")} />
    </Button>
  );
}

export function AgentPanelContent() {
  const close = useAgentStore((s) => s.close);
  const conversations = useAgentStore((s) => s.conversations);
  const activeId = useAgentStore((s) => s.activeId);
  const newConversation = useAgentStore((s) => s.newConversation);
  const selectConversation = useAgentStore((s) => s.selectConversation);
  const deleteConversation = useAgentStore((s) => s.deleteConversation);

  // Always have at least one conversation when the panel is mounted.
  useEffect(() => {
    if (conversations.length === 0) {
      newConversation();
    } else if (!activeId || !conversations.some((c) => c.id === activeId)) {
      selectConversation(conversations[0].id);
    }
  }, [conversations, activeId, newConversation, selectConversation]);

  const activeConv = conversations.find((c) => c.id === activeId);

  return (
    <div className="flex h-full flex-col bg-background-surface">
      <TabStrip
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConversation}
        onClose={deleteConversation}
        onNew={newConversation}
        onClosePanel={close}
      />

      {activeConv && (
        // key={activeConv.id} so useChat reinitializes with the right history
        // when the user switches tabs.
        <Chat
          key={activeConv.id}
          conversation={{
            id: activeConv.id,
            messages: activeConv.messages,
            linkedMailId: activeConv.linkedMailId,
          }}
        />
      )}
    </div>
  );
}

interface TabStripProps {
  conversations: { id: string; title: string }[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => string;
  onClosePanel: () => void;
}

function TabStrip({
  conversations,
  activeId,
  onSelect,
  onClose,
  onNew,
  onClosePanel,
}: TabStripProps) {
  return (
    <div className="flex shrink-0 items-stretch border-b-[0.5px] border-[#1a1a1c] bg-[#0d0d0d]">
      <div className="flex min-w-0 flex-1 items-center gap-px overflow-x-auto">
        {conversations.map((c) => {
          const isActive = c.id === activeId;
          return (
            <div
              key={c.id}
              className={cn(
                "group flex shrink-0 items-center gap-1.5 border-r-[0.5px] border-[#1a1a1c] pr-1 transition-colors",
                isActive
                  ? "bg-background-surface"
                  : "bg-transparent hover:bg-background-subtle"
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={cn(
                  "ty-caption max-w-[140px] truncate px-3 py-2 text-left",
                  isActive
                    ? "text-primary-text"
                    : "text-tertiary-text hover:text-secondary-text"
                )}
                title={c.title}
              >
                {c.title}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(c.id);
                }}
                aria-label="Close chat"
                className={cn(
                  "flex size-4 items-center justify-center rounded-[2px] text-tertiary-text opacity-0 transition-opacity hover:bg-background-elevated hover:text-primary-text group-hover:opacity-100",
                  isActive && "opacity-100"
                )}
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => onNew()}
          aria-label="New chat"
          className="flex size-8 shrink-0 items-center justify-center text-tertiary-text transition-colors hover:bg-background-subtle hover:text-primary-text"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <button
        type="button"
        onClick={onClosePanel}
        aria-label="Close Hermes"
        className="flex size-8 shrink-0 items-center justify-center border-l-[0.5px] border-[#1a1a1c] text-tertiary-text transition-colors hover:bg-background-subtle hover:text-primary-text"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
