"use client";

import { useMemo, useState } from "react";
import { FolderRail } from "@/components/email/folder-rail";
import { MessageList } from "@/components/email/message-list";
import { MessageView } from "@/components/email/message-view";
import { ComposeCard, type ComposeDraft } from "@/components/email/compose-card";
import {
  unreadCounts,
  type FolderId,
  type Message,
} from "@/lib/email/mailbox";

/** A reply seeds the composer with the recipient, a quoted subject, and the
 * original message so Archon can draft a contextual response. */
function replyDraft(message: Message): ComposeDraft {
  const subject = message.subject.startsWith("Re:")
    ? message.subject
    : `Re: ${message.subject}`;
  return {
    to: message.from.email,
    subject,
    body: "",
    original: {
      from: `${message.from.name} <${message.from.email}>`,
      subject: message.subject,
      body: message.body,
    },
  };
}

const EMPTY_DRAFT: ComposeDraft = { to: "", subject: "", body: "" };

export function EmailApp({
  initialMessages,
  live,
}: {
  initialMessages: Message[];
  live: boolean;
}) {
  // The mailbox is held in state so starring (and future mutations) reflect
  // immediately; the server data seeds it.
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [folder, setFolder] = useState<FolderId>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [composing, setComposing] = useState<ComposeDraft | null>(null);

  // A stable "now" for relative timestamps within a single render pass.
  const now = useMemo(() => new Date(), []);

  const counts = useMemo(() => unreadCounts(messages), [messages]);

  const folderMessages = useMemo(
    () =>
      messages
        .filter((m) => m.folder === folder)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [messages, folder]
  );

  const selected = folderMessages.find((m) => m.id === selectedId) ?? null;

  function selectFolder(next: FolderId) {
    setFolder(next);
    setSelectedId(null);
    setComposing(null);
  }

  function openMessage(id: string) {
    setSelectedId(id);
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, read: true } : m))
    );
  }

  function toggleStar(id: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, starred: !m.starred } : m))
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      {!live && (
        <div className="shrink-0 border-b bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Showing sample data. Connect Google Workspace to read and send your
          real email — see <code className="font-mono">docs/gmail.md</code>.
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <FolderRail
        active={folder}
        onSelect={selectFolder}
        counts={counts}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        onCompose={() => setComposing(EMPTY_DRAFT)}
      />
      <MessageList
        folder={folder}
        messages={folderMessages}
        selectedId={selectedId}
        onSelect={openMessage}
        now={now}
      />
      {/* The message stays mounted while composing; the compose card floats
          over the bottom of this pane so the message being replied to (and its
          quoted thread) remains visible above it. */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <MessageView
          message={selected}
          onReply={(m) => setComposing(replyDraft(m))}
          onToggleStar={toggleStar}
        />
        {composing && (
          <ComposeCard initial={composing} onClose={() => setComposing(null)} />
        )}
      </div>
      </div>
    </div>
  );
}
