import type { MailParticipant } from "@/lib/email/mailbox";

/** Two-letter initials for an avatar fallback. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Compact, relative-ish timestamp for the message list (e.g. "9:40 AM",
 * "Yesterday", "Jun 20"). `now` is passed in so callers control the clock.
 */
export function listTime(iso: string, now: Date): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Full timestamp for the open message header (e.g. "Jun 22, 2026, 9:40 AM"). */
export function fullTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Display label for a recipient list (used in the Sent/Drafts preview). */
export function recipientLabel(to: MailParticipant[]): string {
  if (to.length === 0) return "(no recipient)";
  if (to.length === 1) return to[0].name;
  return `${to[0].name} +${to.length - 1}`;
}
