import "server-only";

import { getAppUrl } from "@/lib/env";
import { sendBrevoEmail } from "@/lib/email/brevo";

/**
 * Build + send the member invite email. The secure invite link is delivered
 * here (it is no longer shown in the UI to copy/paste), so a delivery failure
 * is meaningful: the caller rolls back the pending invite when this throws.
 */

/** Minimal HTML escaping for values interpolated into the email body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Absolute invite URL for a raw token, built from the configured app URL. */
export function inviteUrl(token: string): string {
  return `${getAppUrl().replace(/\/$/, "")}/invite/${token}`;
}

export interface SendInviteEmailInput {
  /** Invitee display name (may be empty). */
  name: string;
  /** Invitee email — the recipient. */
  email: string;
  /** Raw, single-use invite token to embed in the link. */
  token: string;
}

/** Send the invite link to the invitee. Throws on delivery failure. */
export async function sendInviteEmail({
  name,
  email,
  token,
}: SendInviteEmailInput): Promise<void> {
  const url = inviteUrl(token);
  const safeName = escapeHtml(name.trim());
  const greeting = safeName ? `Hi ${safeName},` : "Hi,";

  const htmlContent = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;">
      <tr>
        <td style="padding:28px;">
          <p style="margin:0 0 12px;font-size:15px;">${greeting}</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">
            You've been invited to join a workspace on Wildcat. Click the button
            below to set up your account and get started.
          </p>
          <p style="margin:0 0 24px;">
            <a href="${url}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:15px;font-weight:600;">Accept invite</a>
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#78716c;">Or paste this link into your browser:</p>
          <p style="margin:0 0 20px;font-size:13px;word-break:break-all;"><a href="${url}" style="color:#0369a1;">${url}</a></p>
          <p style="margin:0;font-size:12px;color:#a8a29e;">This invite link expires in 7 days. If you weren't expecting it, you can ignore this email.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textContent = `${name.trim() ? `Hi ${name.trim()},` : "Hi,"}

You've been invited to join a workspace on Wildcat.

Accept your invite: ${url}

This invite link expires in 7 days. If you weren't expecting it, you can ignore this email.`;

  await sendBrevoEmail({
    to: [{ email, name: name.trim() || undefined }],
    subject: "You've been invited to Wildcat",
    htmlContent,
    textContent,
  });
}
