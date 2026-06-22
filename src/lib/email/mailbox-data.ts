import "server-only";

import { hasGmail, listGmailMessages } from "@/lib/email/gmail";
import { MOCK_MESSAGES, type Message } from "@/lib/email/mailbox";

/**
 * Server-only mailbox loader. Kept apart from `./mailbox` (which is pure and
 * client-safe) so importing mail types into client components never drags the
 * `server-only` Gmail client into the browser bundle.
 */

export interface Mailbox {
  messages: Message[];
  /** Whether these are live Gmail messages (true) or mock samples (false). */
  live: boolean;
}

/**
 * Load the mailbox. Reads live messages from Gmail when Workspace credentials
 * are configured; otherwise returns the mock sample set so the page is fully
 * usable out of the box.
 */
export async function getMailbox(): Promise<Mailbox> {
  if (await hasGmail()) {
    const messages = await listGmailMessages();
    return { messages, live: true };
  }
  return { messages: MOCK_MESSAGES, live: false };
}
