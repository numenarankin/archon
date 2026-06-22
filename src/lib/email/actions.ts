"use server";

import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { hasGmail, sendGmailMessage } from "@/lib/email/gmail";
import { userCan } from "@/lib/auth/permissions";
import { getProfile } from "@/lib/settings/profile";

export interface SendResult {
  ok: boolean;
  /** True when the message was actually delivered via Gmail (vs. simulated). */
  delivered: boolean;
  error?: string;
}

/**
 * Send a message. When Google Workspace is configured the email is delivered
 * through the Gmail API; otherwise the send is simulated so the compose flow
 * works end-to-end against mock data.
 */
export async function sendMessage(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  const to = input.to.trim();
  if (!to) return { ok: false, delivered: false, error: "Add at least one recipient." };

  if (!(await hasGmail())) {
    // Mock mode: pretend it went out so the UI can confirm + reset.
    return { ok: true, delivered: false };
  }

  try {
    await sendGmailMessage({ to, subject: input.subject, body: input.body });
    return { ok: true, delivered: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Failed to send.";
    return { ok: false, delivered: false, error };
  }
}

const DRAFT_MODEL = "claude-opus-4-8";

/**
 * System prompt for the reply-drafting assistant. It is deliberately scoped to
 * ONE job — produce a SEND-READY body for the human to review. It is given no
 * sending capability of any kind: this action only ever returns a string, so
 * Archon can draft email but can never send it. The user is always the one who
 * clicks Send.
 *
 * The hard rules exist because earlier drafts leaked placeholders ("[Your
 * name]", "[add details]") and meta-commentary about the draft — both make the
 * email un-sendable. The output must read as a finished email, nothing else.
 */
const DRAFT_SYSTEM = `You are Archon, drafting an email that the user will quickly review and send.

Output ONLY the body of the email. It must be complete and ready to send exactly as written.

Hard rules — follow every one:
- NEVER use placeholders or fill-in-the-blank tokens of ANY kind. No square brackets, no "[Your name]", "[date]", "[add details here]", "[rate]", no ALL-CAPS slots, no "TODO", no underscores to fill in. Not one.
- NEVER include commentary, notes, caveats, or explanations about the draft itself. Do not add a postscript explaining assumptions you made. The reply ends at the signature — nothing after it.
- NEVER include a subject line, a "To:" header, markdown, or horizontal rules ("---").
- NEVER use em dashes or semicolons. Rewrite with commas, periods, or separate sentences instead.
- Make reasonable, professional assumptions so the email stands entirely on its own. If a specific detail is genuinely unknown, phrase around it naturally (e.g. propose a call to discuss specifics) — never leave a blank for the user to fill.
- Sign off with the user's name exactly as provided. If no name is provided, end with a simple closing line such as "Best regards," and stop — do NOT invent a name and do NOT use a placeholder.

Keep it concise, natural, warm, and professional.`;

/**
 * Defensive cleanup in case the model still slips in a placeholder or a trailing
 * meta note. Strips any "--- ..." postscript and any line containing a
 * bracketed fill-in token, so what lands in the composer is send-ready.
 */
function sanitizeDraft(text: string): string {
  let out = text.trim();

  // Drop a trailing meta note separated by a markdown horizontal rule.
  const hr = out.search(/\n\s*-{3,}\s*(\n|$)/);
  if (hr !== -1) out = out.slice(0, hr).trim();

  // Remove any line that still contains a [bracketed] placeholder.
  out = out
    .split("\n")
    .filter((line) => !/\[[^\]]*\]/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return out;
}

export interface DraftResult {
  ok: boolean;
  draft?: string;
  error?: string;
}

/**
 * Ask Archon to draft a reply body. Generation only — there is no send path
 * here, by design. Returns the draft text for the composer to populate.
 */
export async function draftReply(input: {
  /** The message being replied to, if this is a reply. */
  original?: { from: string; subject: string; body: string };
  /** Recipient + subject of the draft, for context on a fresh compose. */
  to?: string;
  subject?: string;
}): Promise<DraftResult> {
  if (!(await userCan("use_ai"))) {
    return { ok: false, error: "You don't have access to Archon." };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error: "Archon isn't configured. Set ANTHROPIC_API_KEY to draft replies.",
    };
  }

  const profile = await getProfile();
  const signature = profile.name?.trim() || "";

  // The sign-off instruction is stated explicitly so the model never falls back
  // to a "[Your name]" placeholder.
  const signoff = signature
    ? `Sign off as "${signature}".`
    : `No sender name is available — close with a simple line like "Best regards," and stop. Do not invent a name or leave a placeholder.`;

  const prompt = input.original
    ? `Write a complete, send-ready reply to the email below. ${signoff}

--- Email you are replying to ---
From: ${input.original.from}
Subject: ${input.original.subject}

${input.original.body}
--- End of email ---

Reply now with the finished body only.`
    : `Write a complete, send-ready email${input.to ? ` to ${input.to}` : ""}${
        input.subject ? ` with the subject "${input.subject}"` : ""
      }. ${signoff}

Reply now with the finished body only.`;

  try {
    const { text } = await generateText({
      model: anthropic(DRAFT_MODEL),
      system: DRAFT_SYSTEM,
      prompt,
      temperature: 0.4,
    });
    const draft = sanitizeDraft(text);
    if (!draft) return { ok: false, error: "Archon returned an empty draft." };
    return { ok: true, draft };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Couldn't draft a reply.";
    return { ok: false, error };
  }
}
