/**
 * Shared support-chat types for the platform (staff) side. Plain module (no
 * `server-only`) so both the client components and the server data/action
 * modules can import it. Mirrors the webapp's support types, plus the requester.
 */

export type SupportSenderRole = "user" | "staff";

export type SupportStatus = "open" | "closed";

/** A file attached to a support message. `url` is a short-lived signed link. */
export interface SupportAttachment {
  id: string;
  name: string;
  url: string | null;
}

/** One message in a support thread. `createdAt` is epoch ms for easy sorting. */
export interface SupportMessage {
  id: string;
  threadId: string;
  senderRole: SupportSenderRole;
  body: string;
  createdAt: number;
  attachments: SupportAttachment[];
}

/** The end user a support thread belongs to. */
export interface SupportRequester {
  id: string;
  name: string;
  email: string;
}

/** A support thread with its messages and requester, newest-activity first. */
export interface SupportThread {
  id: string;
  subject: string;
  status: SupportStatus;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
  /** Unread from the staff perspective (last message came from the user). */
  unread: boolean;
  requester: SupportRequester;
  messages: SupportMessage[];
}
