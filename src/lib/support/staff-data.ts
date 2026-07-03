import "server-only";

import { getWebappDb } from "@/lib/support/webapp-db";
import {
  assembleStaffThreads,
  type StaffAttachmentRow,
  type StaffMessageRow,
  type StaffThreadRow,
} from "@/lib/support/assemble";
import type { SupportRequester, SupportThread } from "@/lib/support/types";

const FILES_BUCKET = "files";
const SIGNED_URL_TTL = 60 * 60; // one hour, matches the webapp side

/**
 * Load EVERY support thread (cross-tenant) for the staff inbox, newest activity
 * first, with messages, attachments, and the resolved requester per thread.
 *
 * Reaches the webapp's Supabase project with its service-role key (RLS bypassed)
 * — that is the whole point of the staff side. Returns an empty list when the
 * webapp backend isn't configured so the page degrades to an empty inbox.
 */
export async function getStaffSupportThreads(): Promise<SupportThread[]> {
  const db = getWebappDb();
  if (!db) return [];

  const { data: threads, error: tErr } = await db
    .from("support_threads")
    .select(
      "id, owner_id, subject, status, created_at, updated_at, last_message_at, staff_last_read_at"
    )
    .order("last_message_at", { ascending: false });
  if (tErr) throw new Error(`getStaffSupportThreads: ${tErr.message}`);
  if (!threads || threads.length === 0) return [];

  const threadRows = threads as StaffThreadRow[];
  const ids = threadRows.map((t) => t.id);

  const { data: messages, error: mErr } = await db
    .from("support_messages")
    .select("id, thread_id, sender_role, body, created_at")
    .in("thread_id", ids)
    .order("position", { ascending: true });
  if (mErr) throw new Error(`getStaffSupportThreads (messages): ${mErr.message}`);
  const messageRows = (messages ?? []) as StaffMessageRow[];

  // Attachments (files join → flat rows).
  const messageIds = messageRows.map((m) => m.id);
  let attachmentRows: StaffAttachmentRow[] = [];
  if (messageIds.length > 0) {
    const { data: att, error: aErr } = await db
      .from("support_message_files")
      .select("message_id, file_id, files(name, storage_key)")
      .in("message_id", messageIds);
    if (aErr) throw new Error(`getStaffSupportThreads (attachments): ${aErr.message}`);
    attachmentRows = (att ?? []).map((a) => {
      const row = a as unknown as {
        message_id: string;
        file_id: string;
        files: { name: string | null; storage_key: string | null } | null;
      };
      return {
        message_id: row.message_id,
        file_id: row.file_id,
        name: row.files?.name ?? null,
        storageKey: row.files?.storage_key ?? null,
      };
    });
  }

  // Sign every distinct attachment key once (service role reaches the private bucket).
  const keys = [
    ...new Set(
      attachmentRows
        .map((a) => a.storageKey)
        .filter((k): k is string => !!k)
    ),
  ];
  const urlByKey = new Map<string, string>();
  await Promise.all(
    keys.map(async (key) => {
      const { data } = await db.storage
        .from(FILES_BUCKET)
        .createSignedUrl(key, SIGNED_URL_TTL);
      if (data?.signedUrl) urlByKey.set(key, data.signedUrl);
    })
  );

  // Resolve each distinct owner to name/email via the Admin Auth API. The webapp
  // `org_members` table is email-keyed with no auth link, so auth.users (through
  // the admin client) is the reliable identity source.
  const ownerIds = [...new Set(threadRows.map((t) => t.owner_id))];
  const requesterById = new Map<string, SupportRequester>();
  await Promise.all(
    ownerIds.map(async (id) => {
      try {
        const { data } = await db.auth.admin.getUserById(id);
        const u = data?.user;
        if (!u) return;
        const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
        const name =
          (typeof meta.name === "string" && meta.name) ||
          (typeof meta.full_name === "string" && meta.full_name) ||
          u.email ||
          "User";
        requesterById.set(id, { id, name, email: u.email ?? "" });
      } catch (error) {
        console.error("getStaffSupportThreads: requester resolve failed", id, error);
      }
    })
  );

  return assembleStaffThreads(
    threadRows,
    messageRows,
    attachmentRows,
    requesterById,
    urlByKey
  );
}
