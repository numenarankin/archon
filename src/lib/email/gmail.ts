import "server-only";

import type { FolderId, Message, MailParticipant } from "@/lib/email/mailbox";
import {
  hasGoogleAuth,
  getGoogleAccessToken,
  getGoogleCredentials,
} from "@/lib/google/auth";

/**
 * Google Workspace (Gmail API) client.
 *
 * This activates automatically once the OAuth credentials below are set in the
 * environment — no extra npm packages required, it talks to the Gmail REST API
 * with `fetch`. Until then `hasGmail()` returns false and the Email page falls
 * back to mock data. Setup steps live in `docs/gmail.md`.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID       OAuth 2.0 client ID
 *   GOOGLE_CLIENT_SECRET   OAuth 2.0 client secret
 *   GOOGLE_REFRESH_TOKEN   Long-lived refresh token for the mailbox owner
 *   GOOGLE_USER_EMAIL      The mailbox address (used as the API "userId")
 */

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** How many messages to pull per folder for the list view. */
const PER_FOLDER_LIMIT = 25;

/** Whether Google Workspace credentials are present (shared Gmail/Calendar). */
export const hasGmail = hasGoogleAuth;

/** Gmail label query (one per folder) used to scope the message list. */
const FOLDER_QUERY: Record<FolderId, string> = {
  inbox: "in:inbox",
  starred: "is:starred",
  sent: "in:sent",
  drafts: "in:drafts",
  archive: "-in:inbox -in:sent -in:drafts -in:trash",
  trash: "in:trash",
};

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessagePayload {
  headers?: GmailHeader[];
  parts?: GmailMessagePayload[];
  mimeType?: string;
  body?: { data?: string };
  filename?: string;
}

interface GmailMessage {
  id: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: GmailMessagePayload;
}

function header(payload: GmailMessagePayload | undefined, name: string): string {
  const h = payload?.headers?.find(
    (x) => x.name.toLowerCase() === name.toLowerCase()
  );
  return h?.value ?? "";
}

/** Parse a `Name <email>` header into a participant. */
function parseParticipant(raw: string): MailParticipant {
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  if (match) return { name: match[1].trim() || match[2].trim(), email: match[2].trim() };
  const email = raw.trim();
  return { name: email, email };
}

function parseParticipants(raw: string): MailParticipant[] {
  if (!raw.trim()) return [];
  return raw.split(",").map(parseParticipant);
}

/** Recursively pull the best plain-text body out of a Gmail payload. */
function extractBody(payload: GmailMessagePayload | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractBody(part);
    if (text) return text;
  }
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

function extractAttachments(payload: GmailMessagePayload | undefined): string[] {
  const names: string[] = [];
  const walk = (p?: GmailMessagePayload) => {
    if (!p) return;
    if (p.filename) names.push(p.filename);
    for (const part of p.parts ?? []) walk(part);
  };
  walk(payload);
  return names;
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function mapGmailMessage(folder: FolderId, msg: GmailMessage): Message {
  const date = msg.internalDate
    ? new Date(Number(msg.internalDate)).toISOString()
    : new Date().toISOString();
  return {
    id: msg.id,
    folder,
    from: parseParticipant(header(msg.payload, "From")),
    to: parseParticipants(header(msg.payload, "To")),
    subject: header(msg.payload, "Subject") || "(no subject)",
    snippet: msg.snippet ?? "",
    body: extractBody(msg.payload),
    date,
    read: !(msg.labelIds ?? []).includes("UNREAD"),
    starred: (msg.labelIds ?? []).includes("STARRED"),
    attachments: extractAttachments(msg.payload).filter(Boolean),
  };
}

async function authedFetch(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gmail API error (${res.status}): ${detail}`);
  }
  return res.json();
}

/**
 * Fetch recent messages across every folder and map them to our `Message`
 * shape. Folders are queried in parallel; each message is then fetched for its
 * headers and body.
 */
export async function listGmailMessages(): Promise<Message[]> {
  const token = await getGoogleAccessToken();
  const folders = Object.keys(FOLDER_QUERY) as FolderId[];

  const perFolder = await Promise.all(
    folders.map(async (folder) => {
      const q = encodeURIComponent(FOLDER_QUERY[folder]);
      const list = (await authedFetch(
        `/messages?maxResults=${PER_FOLDER_LIMIT}&q=${q}`,
        token
      )) as { messages?: { id: string }[] };

      const ids = (list.messages ?? []).map((m) => m.id);
      const full = await Promise.all(
        ids.map(
          (id) =>
            authedFetch(`/messages/${id}?format=full`, token) as Promise<GmailMessage>
        )
      );
      return full.map((m) => mapGmailMessage(folder, m));
    })
  );

  return perFolder.flat();
}

export interface SendGmailInput {
  to: string;
  subject: string;
  body: string;
}

/** Build an RFC 2822 message and hand it to the Gmail send endpoint. */
export async function sendGmailMessage(input: SendGmailInput): Promise<void> {
  const creds = await getGoogleCredentials();
  if (!creds) throw new Error("Google Workspace is not configured.");
  const token = await getGoogleAccessToken(creds);
  const from = creds.userEmail;

  const raw = [
    `From: ${from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.body,
  ].join("\r\n");

  const encoded = Buffer.from(raw, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gmail send failed (${res.status}): ${detail}`);
  }
}
