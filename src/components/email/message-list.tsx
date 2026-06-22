"use client";

import { StarIcon, PaperclipIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAIL_FOLDERS, type FolderId, type Message } from "@/lib/email/mailbox";
import { listTime, recipientLabel } from "@/lib/email/format";

/** Folders whose previews lead with the recipient ("To: …") rather than sender. */
const OUTGOING: ReadonlySet<FolderId> = new Set(["sent", "drafts"]);

function folderLabel(id: FolderId): string {
  return MAIL_FOLDERS.find((f) => f.id === id)?.label ?? id;
}

export function MessageList({
  folder,
  messages,
  selectedId,
  onSelect,
  now,
}: {
  folder: FolderId;
  messages: Message[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: Date;
}) {
  const outgoing = OUTGOING.has(folder);

  return (
    <div className="flex h-full w-full flex-col border-r bg-background md:w-80 lg:w-96 md:shrink-0">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">{folderLabel(folder)}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {messages.length}
        </span>
      </div>

      {messages.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No messages in {folderLabel(folder).toLowerCase()}.
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {messages.map((m) => {
            const isSelected = m.id === selectedId;
            const primary = outgoing ? recipientLabel(m.to) : m.from.name;
            const unread = !m.read && !outgoing;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onSelect(m.id)}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "flex w-full flex-col gap-1 border-b px-4 py-3 text-left transition-colors",
                    isSelected ? "bg-muted" : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {unread && (
                      <span
                        className="size-2 shrink-0 rounded-full bg-primary"
                        aria-label="Unread"
                      />
                    )}
                    <span
                      className={cn(
                        "flex-1 truncate text-sm",
                        unread ? "font-semibold text-foreground" : "text-foreground/90"
                      )}
                    >
                      {primary}
                    </span>
                    {m.starred && (
                      <StarIcon className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
                    )}
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {listTime(m.date, now)}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "truncate text-sm",
                      unread ? "font-medium text-foreground" : "text-foreground/80"
                    )}
                  >
                    {m.subject || "(no subject)"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1 truncate text-xs text-muted-foreground">
                      {m.snippet}
                    </span>
                    {m.attachments && m.attachments.length > 0 && (
                      <PaperclipIcon className="size-3 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
