"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { ArchonConversationList } from "@/components/ai/archon-conversation-list";
import { ArchonChat } from "@/components/ai/archon-chat";
import { ArchonVoiceChat } from "@/components/ai/archon-voice-chat";
import { useVoiceMode } from "@/lib/ai/use-voice-mode";
import { useAiDrawer } from "@/lib/ai/use-ai-drawer";
import {
  deleteConversation,
  saveMessages,
} from "@/lib/ai/conversation-actions";
import { NEW_CHAT_TITLE, type Conversation } from "@/lib/ai/conversations";

/**
 * A fresh, unsaved conversation. It only becomes a DB row once the user sends a
 * message (via `saveMessages`), so empty "New chat" entries never get persisted.
 */
function makeDraft(): Conversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: NEW_CHAT_TITLE,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function ArchonWorkspace({
  initialConversations,
}: {
  initialConversations: Conversation[];
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  );
  const voiceEnabled = useVoiceMode((s) => s.enabled);
  const drawerOpen = useAiDrawer((s) => s.open);
  // The open drawer hosts the voice loop; the page yields to it so only one mic
  // runs. With the drawer closed, voice takes over the full page inline.
  const voiceInline = voiceEnabled && !drawerOpen;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always keep exactly one active conversation. When none exist, seed a single
  // client-side draft (not written to the DB). Replacement semantics keep this
  // idempotent even under StrictMode double-invocation.
  useEffect(() => {
    if (activeId && conversations.some((c) => c.id === activeId)) return;
    if (conversations.length > 0) {
      setActiveId(conversations[0].id);
      return;
    }
    const draft = makeDraft();
    setConversations([draft]);
    setActiveId(draft.id);
  }, [activeId, conversations]);

  const handleCreate = useCallback(() => {
    setConversations((prev) => {
      // Reuse an existing empty conversation instead of stacking blank drafts.
      const existingEmpty = prev.find((c) => c.messages.length === 0);
      if (existingEmpty) {
        setActiveId(existingEmpty.id);
        return prev;
      }
      const draft = makeDraft();
      setActiveId(draft.id);
      return [draft, ...prev];
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setActiveId((prev) => (prev === id ? null : prev));
    // No-op for drafts that were never persisted.
    deleteConversation(id).catch((error) =>
      console.error("Failed to delete conversation", error)
    );
  }, []);

  const handleMessagesChange = useCallback(
    (messages: UIMessage[]) => {
      if (!activeId) return;
      const id = activeId;
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, messages } : c))
      );
      // Don't persist an empty conversation; only save once there's content.
      if (messages.length === 0) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveMessages(id, messages).catch((error) =>
          console.error("Failed to save messages", error)
        );
      }, 800);
    },
    [activeId]
  );

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
      <ArchonConversationList
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={handleCreate}
        onDelete={handleDelete}
      />
      {active &&
        (voiceInline ? (
          <ArchonVoiceChat
            key={`voice-${active.id}`}
            conversation={active}
            onMessagesChange={handleMessagesChange}
          />
        ) : (
          <ArchonChat
            key={active.id}
            conversation={active}
            onMessagesChange={handleMessagesChange}
          />
        ))}
    </div>
  );
}
