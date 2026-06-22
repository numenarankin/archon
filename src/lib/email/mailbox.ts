/**
 * Mailbox types, folder definitions, and the mock sample set for the Email
 * page. This module is intentionally PURE (no `server-only` imports) so client
 * components can import the types and `MAIL_FOLDERS`/`unreadCounts` freely. The
 * server-only data loader that talks to Gmail lives in `./mailbox-data`.
 */

/** The folders shown in the left rail, in display order. */
export type FolderId = "inbox" | "starred" | "sent" | "drafts" | "archive" | "trash";

export interface MailFolder {
  id: FolderId;
  label: string;
}

/** Folder definitions, top-to-bottom. Inbox / Sent / Drafts are the core three. */
export const MAIL_FOLDERS: MailFolder[] = [
  { id: "inbox", label: "Inbox" },
  { id: "starred", label: "Starred" },
  { id: "sent", label: "Sent" },
  { id: "drafts", label: "Drafts" },
  { id: "archive", label: "Archive" },
  { id: "trash", label: "Trash" },
];

export interface MailParticipant {
  name: string;
  email: string;
}

/** One message in the mailbox. `body` is plain text with paragraph breaks. */
export interface Message {
  id: string;
  folder: FolderId;
  from: MailParticipant;
  to: MailParticipant[];
  subject: string;
  /** Short preview shown in the middle column. */
  snippet: string;
  /** Full message body, plain text. Paragraphs separated by blank lines. */
  body: string;
  /** ISO timestamp the message was sent/received. */
  date: string;
  read: boolean;
  starred: boolean;
  /** Names of attachments, if any. */
  attachments?: string[];
}

const ME: MailParticipant = { name: "Rankin Poage", email: "rankin@wildcatlabs.io" };

/**
 * Static sample inbox. Dates are fixed (not relative to "now") so the page
 * renders deterministically; the relative-time formatter handles display.
 */
export const MOCK_MESSAGES: Message[] = [
  {
    id: "m1",
    folder: "inbox",
    from: { name: "Texas RRC Notifications", email: "no-reply@rrc.texas.gov" },
    to: [ME],
    subject: "Proration schedule WLF-100 posted for July",
    snippet:
      "The July allowable and proration schedule for your operated wells is now available for download.",
    body: `Hi Rankin,

The July allowable and proration schedule (WLF-100) for your operated wells is now available in the operator portal.

No action is required unless you intend to file for an exception. The filing window closes June 30.

Texas Railroad Commission`,
    date: "2026-06-22T13:40:00Z",
    read: false,
    starred: true,
    attachments: ["WLF-100-July.pdf"],
  },
  {
    id: "m2",
    folder: "inbox",
    from: { name: "Dana Whitfield", email: "dana@plateaumidstream.com" },
    to: [ME],
    subject: "Re: Gathering agreement — redlines attached",
    snippet:
      "Thanks for the quick turnaround. I marked up section 4 on the pressure commitments — take a look when you can.",
    body: `Rankin,

Thanks for the quick turnaround. I marked up section 4 on the pressure commitments and left a couple of comments on the dedication map.

If section 4 works for your team, I think we're clear to route for signature this week.

Best,
Dana`,
    date: "2026-06-22T11:05:00Z",
    read: false,
    starred: false,
    attachments: ["Gathering-Agreement-v3-redline.docx"],
  },
  {
    id: "m3",
    folder: "inbox",
    from: { name: "Marisol Vega", email: "marisol@apexfieldservices.com" },
    to: [ME],
    subject: "Pumper report — Section 14 wells",
    snippet:
      "All three wells flowing within range. Casing pressure on the 2H crept up overnight, keeping an eye on it.",
    body: `Morning,

All three wells in Section 14 are flowing within range this morning. Casing pressure on the 2H crept up a bit overnight — nothing alarming, but I'll keep an eye on it and call if it keeps climbing.

Tank levels look good for a haul-off Thursday.

Marisol`,
    date: "2026-06-22T06:18:00Z",
    read: true,
    starred: false,
  },
  {
    id: "m4",
    folder: "inbox",
    from: { name: "First Permian Bank", email: "statements@firstpermian.com" },
    to: [ME],
    subject: "Your June operating account statement is ready",
    snippet:
      "Your monthly statement for account ending 4471 is now available in online banking.",
    body: `Dear Customer,

Your monthly statement for the operating account ending in 4471 is now available to view in online banking.

Please do not reply to this message.

First Permian Bank`,
    date: "2026-06-21T22:00:00Z",
    read: true,
    starred: false,
  },
  {
    id: "m5",
    folder: "inbox",
    from: { name: "Cole Ferrante", email: "cole@ferranteland.com" },
    to: [ME],
    subject: "Lease renewal — Caldwell tract",
    snippet:
      "The Caldwell heirs are agreeable to a two-year extension at the same bonus. Want me to draft the amendment?",
    body: `Rankin,

Good news on the Caldwell tract — the heirs are agreeable to a two-year extension at the same bonus per acre. They'd like to keep the existing depth clause as-is.

Want me to draft the amendment and circulate for signature? I can have it over to you by Friday.

Cole`,
    date: "2026-06-20T16:32:00Z",
    read: true,
    starred: true,
  },
  {
    id: "m6",
    folder: "sent",
    from: ME,
    to: [{ name: "Dana Whitfield", email: "dana@plateaumidstream.com" }],
    subject: "Re: Gathering agreement — redlines attached",
    snippet:
      "Section 4 looks good on our end. Go ahead and route for signature — I'll have our side ready.",
    body: `Dana,

Section 4 looks good on our end — the pressure commitments line up with what we modeled. Go ahead and route for signature and I'll make sure our side is ready to execute.

Appreciate the fast turnaround.

Rankin`,
    date: "2026-06-22T12:10:00Z",
    read: true,
    starred: false,
  },
  {
    id: "m7",
    folder: "sent",
    from: ME,
    to: [{ name: "Marisol Vega", email: "marisol@apexfieldservices.com" }],
    subject: "Section 14 — watch the 2H casing pressure",
    snippet:
      "Thanks Marisol. Log the casing pressure every few hours today and text me if it tops 350.",
    body: `Thanks Marisol.

Let's log the casing pressure on the 2H every few hours today. Text me directly if it tops 350 psi and we'll get someone out.

Tank haul-off Thursday is fine.

Rankin`,
    date: "2026-06-22T07:02:00Z",
    read: true,
    starred: false,
  },
  {
    id: "m8",
    folder: "drafts",
    from: ME,
    to: [{ name: "Cole Ferrante", email: "cole@ferranteland.com" }],
    subject: "Re: Lease renewal — Caldwell tract",
    snippet:
      "Cole — yes, please draft the amendment. One change on the depth clause before we send it to the heirs:",
    body: `Cole,

Yes, please go ahead and draft the amendment. One thing before it goes to the heirs — I want to tighten the depth clause to

[unfinished]`,
    date: "2026-06-21T18:45:00Z",
    read: true,
    starred: false,
  },
  {
    id: "m9",
    folder: "drafts",
    from: ME,
    to: [],
    subject: "Q3 AFE review — agenda",
    snippet: "Pulling together the agenda for the Q3 AFE review. Topics so far:",
    body: `Team,

Pulling together the agenda for the Q3 AFE review. Topics so far:

- Section 14 recompletion economics
- Updated LOE per BOE
-

[unfinished]`,
    date: "2026-06-19T14:20:00Z",
    read: true,
    starred: false,
  },
  {
    id: "m10",
    folder: "archive",
    from: { name: "Permian Basin Petroleum Assoc.", email: "events@pbpa.org" },
    to: [ME],
    subject: "Thanks for attending the spring summit",
    snippet:
      "We hope you enjoyed the spring summit. Session recordings are now available to registered attendees.",
    body: `Thank you for attending the PBPA Spring Summit.

Session recordings and slide decks are now available to registered attendees in the member portal.

We hope to see you at the fall conference.

PBPA Events Team`,
    date: "2026-05-30T15:00:00Z",
    read: true,
    starred: false,
  },
];

/** Count of unread messages per folder, for the badges in the left rail. */
export function unreadCounts(messages: Message[]): Record<FolderId, number> {
  const counts = {
    inbox: 0,
    starred: 0,
    sent: 0,
    drafts: 0,
    archive: 0,
    trash: 0,
  } as Record<FolderId, number>;
  for (const m of messages) {
    if (!m.read) counts[m.folder] += 1;
  }
  // Drafts badge counts total drafts, not "unread" (drafts are always read).
  counts.drafts = messages.filter((m) => m.folder === "drafts").length;
  return counts;
}
