/**
 * Pure, I/O-free assembly of the staff-side support inbox. Kept free of any
 * `server-only` / Supabase imports so it is unit-testable in isolation (mirrors
 * the webapp's `buildThreads`, but from the staff perspective: it attaches the
 * requester and computes unread against the STAFF read watermark).
 *
 * Inputs are already-fetched rows plus two lookup maps the caller resolves with
 * I/O (signed attachment URLs by storage key; requester identity by owner id),
 * so this function stays synchronous and deterministic.
 */

import type {
  SupportAttachment,
  SupportMessage,
  SupportRequester,
  SupportSenderRole,
  SupportStatus,
  SupportThread,
} from "@/lib/support/types";

export interface StaffThreadRow {
  id: string;
  owner_id: string;
  subject: string;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  staff_last_read_at: string | null;
}

export interface StaffMessageRow {
  id: string;
  thread_id: string;
  sender_role: SupportSenderRole;
  body: string;
  created_at: string;
}

/** Flattened attachment row (the `files` join already resolved to name + key). */
export interface StaffAttachmentRow {
  message_id: string;
  file_id: string;
  name: string | null;
  storageKey: string | null;
}

/** Placeholder when an owner id can't be resolved to a real user. */
export function unknownRequester(id: string): SupportRequester {
  return { id, name: "Unknown user", email: "" };
}

/**
 * Assemble thread + message + attachment rows into the staff `SupportThread[]`
 * shape. `messageRows` MUST arrive ordered by `position` ascending (per thread);
 * the last message in each bucket drives the unread flag.
 *
 * A thread is unread FOR STAFF when its most recent message came from the user
 * and is newer than `staff_last_read_at` (null watermark ⇒ never read ⇒ unread).
 */
export function assembleStaffThreads(
  threadRows: StaffThreadRow[],
  messageRows: StaffMessageRow[],
  attachmentRows: StaffAttachmentRow[],
  requesterById: Map<string, SupportRequester>,
  urlByKey: Map<string, string>
): SupportThread[] {
  const attachmentsByMessage = new Map<string, SupportAttachment[]>();
  for (const a of attachmentRows) {
    const list = attachmentsByMessage.get(a.message_id) ?? [];
    list.push({
      id: a.file_id,
      name: a.name ?? "file",
      url: a.storageKey ? (urlByKey.get(a.storageKey) ?? null) : null,
    });
    attachmentsByMessage.set(a.message_id, list);
  }

  const messagesByThread = new Map<string, SupportMessage[]>();
  for (const m of messageRows) {
    const list = messagesByThread.get(m.thread_id) ?? [];
    list.push({
      id: m.id,
      threadId: m.thread_id,
      senderRole: m.sender_role,
      body: m.body,
      createdAt: new Date(m.created_at).getTime(),
      attachments: attachmentsByMessage.get(m.id) ?? [],
    });
    messagesByThread.set(m.thread_id, list);
  }

  return threadRows.map((t) => {
    const messages = messagesByThread.get(t.id) ?? [];
    const last = messages[messages.length - 1];
    const lastMessageAt = new Date(t.last_message_at).getTime();
    const unread =
      !!last &&
      last.senderRole === "user" &&
      (t.staff_last_read_at === null ||
        lastMessageAt > new Date(t.staff_last_read_at).getTime());
    return {
      id: t.id,
      subject: t.subject,
      status: t.status,
      createdAt: new Date(t.created_at).getTime(),
      updatedAt: new Date(t.updated_at).getTime(),
      lastMessageAt,
      unread,
      requester: requesterById.get(t.owner_id) ?? unknownRequester(t.owner_id),
      messages,
    };
  });
}
