import "server-only";

/**
 * Low-level Brevo transactional-email client (HTTP API v3).
 *
 * Server-only: the API key must never reach the browser, so this file is never
 * imported from a client component. Configuration comes from the environment —
 * see docs/brevo.md. `hasBrevo()` reports whether sending is wired up;
 * `sendBrevoEmail()` throws a clear error when it isn't, or when Brevo rejects
 * the request.
 */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/** Default "from" display name when `BREVO_SENDER_NAME` is unset. */
const DEFAULT_SENDER_NAME = "Wildcat";

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailInput {
  to: EmailRecipient[];
  subject: string;
  htmlContent: string;
  /** Plain-text fallback for clients that don't render HTML. */
  textContent?: string;
  replyTo?: EmailRecipient;
}

/** Whether transactional email is configured (key + verified sender address). */
export function hasBrevo(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

/**
 * Send one transactional email via Brevo. Resolves with the provider's
 * `messageId` on success; throws when unconfigured or when Brevo returns a
 * non-2xx response (so callers can surface/handle the delivery failure).
 */
export async function sendBrevoEmail(
  input: SendEmailInput
): Promise<{ messageId: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || DEFAULT_SENDER_NAME;

  if (!apiKey || !senderEmail) {
    throw new Error(
      "Email is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL."
    );
  }

  const response = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: input.to,
      subject: input.subject,
      htmlContent: input.htmlContent,
      ...(input.textContent ? { textContent: input.textContent } : {}),
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    }),
  });

  if (!response.ok) {
    // Brevo returns { code, message } on error; fall back to raw text.
    const detail = await response.text().catch(() => "");
    throw new Error(`Brevo send failed (${response.status}): ${detail}`);
  }

  const data = (await response.json().catch(() => ({}))) as {
    messageId?: string;
  };
  return { messageId: data.messageId ?? "" };
}
