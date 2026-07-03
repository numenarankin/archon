"use server";

import { userCan } from "@/lib/auth/permissions";
import { getWebappDb } from "@/lib/support/webapp-db";
import { getStaffSupportThreads } from "@/lib/support/staff-data";
import type { SupportThread } from "@/lib/support/types";

// Support is a staff-comms surface; gate it behind the same capability as the
// email inbox until a dedicated `manage_support` capability exists.
const SUPPORT_PERMISSION = "view_email";

async function assertStaff(): Promise<void> {
  if (!(await userCan(SUPPORT_PERMISSION))) {
    throw new Error("Not authorized to handle support requests.");
  }
}

/**
 * Post a staff reply to a thread in the webapp's database (service role). The
 * insert fires the webapp's triggers: `support_touch_thread` bumps activity and
 * `notify_support_reply` enqueues the owner's notification — so nothing else is
 * needed here to notify the user. Also stamps the staff read watermark.
 */
export async function sendStaffReply(
  threadId: string,
  body: string
): Promise<{ id: string; createdAt: number }> {
  await assertStaff();
  const text = body.trim();
  if (!text) throw new Error("sendStaffReply: empty message");

  const db = getWebappDb();
  if (!db) throw new Error("Support backend not configured (WEBAPP_SUPABASE_*).");

  const { count, error: cErr } = await db
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId);
  if (cErr) throw new Error(`sendStaffReply (count): ${cErr.message}`);
  const position = count ?? 0;

  const { data: inserted, error } = await db
    .from("support_messages")
    .insert({
      thread_id: threadId,
      sender_role: "staff",
      sender_id: null, // staff live in a different project; provenance not stored
      body: text,
      position,
    })
    .select("id, created_at")
    .single();
  if (error) throw new Error(`sendStaffReply: ${error.message}`);

  await db
    .from("support_threads")
    .update({ staff_last_read_at: new Date().toISOString() })
    .eq("id", threadId);

  return { id: inserted.id, createdAt: new Date(inserted.created_at).getTime() };
}

/** Stamp the staff read watermark for a thread (clears its unread dot). */
export async function markStaffThreadRead(threadId: string): Promise<void> {
  await assertStaff();
  const db = getWebappDb();
  if (!db) return;
  const { error } = await db
    .from("support_threads")
    .update({ staff_last_read_at: new Date().toISOString() })
    .eq("id", threadId);
  if (error) throw new Error(`markStaffThreadRead: ${error.message}`);
}

/**
 * Re-fetch the whole inbox. The staff browser can't hold a service-role realtime
 * subscription against the webapp project (RLS would hide every thread from an
 * unauthenticated client), so the inbox polls this action instead. The user side
 * still gets replies live via their own authenticated realtime subscription.
 */
export async function refreshStaffThreads(): Promise<SupportThread[]> {
  await assertStaff();
  return getStaffSupportThreads();
}
