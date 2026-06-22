"use server";

import { revalidatePath } from "next/cache";
import type { UIMessage } from "ai";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  NEW_CHAT_TITLE,
  deriveTitle,
  type Conversation,
} from "@/lib/ai/conversations";
import { refreshProjectMemory as refreshProjectMemoryImpl } from "@/lib/ai/project-memory";

/**
 * Server-action entry point to regenerate a project's curated
 * memory after a turn. Thin wrapper so client components can invoke it; the work
 * lives in lib/ai/project-memory.ts.
 */
export async function refreshProjectMemory(folderId: string): Promise<void> {
  await refreshProjectMemoryImpl(folderId);
}

interface FolderMessageRow {
  conversation_id: string;
  role: "system" | "user" | "assistant";
  parts: UIMessage["parts"];
  position: number;
}

/**
 * All conversations scoped to one project (folder), with their
 * messages, most recently updated first. Powers the per-project chat-history
 * dropdown; the messages let a picked chat rehydrate without a second round trip.
 */
export async function getFolderConversations(
  folderId: string
): Promise<Conversation[]> {
  const sb = await getSupabaseServer();

  const { data: convs, error: convErr } = await sb
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .eq("folder_id", folderId)
    .order("updated_at", { ascending: false });
  if (convErr) throw new Error(`getFolderConversations: ${convErr.message}`);
  if (!convs || convs.length === 0) return [];

  const ids = convs.map((c) => c.id);
  const { data: msgs, error: msgErr } = await sb
    .from("messages")
    .select("conversation_id, role, parts, position")
    .in("conversation_id", ids)
    .order("position", { ascending: true });
  if (msgErr) throw new Error(`getFolderConversations: ${msgErr.message}`);

  const byConv = new Map<string, FolderMessageRow[]>();
  for (const m of (msgs ?? []) as FolderMessageRow[]) {
    const list = byConv.get(m.conversation_id) ?? [];
    list.push(m);
    byConv.set(m.conversation_id, list);
  }

  return convs.map((c) => ({
    id: c.id,
    title: c.title,
    createdAt: new Date(c.created_at).getTime(),
    updatedAt: new Date(c.updated_at).getTime(),
    messages: (byConv.get(c.id) ?? []).map((m) => ({
      id: crypto.randomUUID(),
      role: m.role,
      parts: m.parts ?? [],
    })) as UIMessage[],
  }));
}

/**
 * Drop heavy base64 file bytes before persisting. Keeps the attachment's
 * metadata (filename/type) so chips still render, without storing megabytes.
 */
function stripFileBytes(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => ({
    ...m,
    parts: m.parts.map((p) =>
      p.type === "file" ? { ...p, url: "" } : p
    ) as UIMessage["parts"],
  }));
}

/** Create a new conversation; returns its id. */
export async function createConversation(): Promise<{ id: string }> {
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("conversations")
    .insert({ title: NEW_CHAT_TITLE })
    .select("id")
    .single();
  if (error) throw new Error(`createConversation: ${error.message}`);
  revalidatePath("/archon");
  return { id: data.id };
}

/** Delete a conversation (messages cascade). */
export async function deleteConversation(id: string): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb.from("conversations").delete().eq("id", id);
  if (error) throw new Error(`deleteConversation: ${error.message}`);
  revalidatePath("/archon");
}

/** Rename a conversation. */
export async function renameConversation(
  id: string,
  title: string
): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("conversations")
    .update({ title: title.trim() || NEW_CHAT_TITLE })
    .eq("id", id);
  if (error) throw new Error(`renameConversation: ${error.message}`);
  revalidatePath("/archon");
}

/**
 * Persist the full message list for a conversation. Replaces the rows and bumps
 * the title (derived from the first user message while still untitled). Does NOT
 * revalidate — it's a silent background save during/after a chat turn.
 */
export async function saveMessages(
  id: string,
  messages: UIMessage[],
  folderId?: string
): Promise<void> {
  const sb = await getSupabaseServer();

  const { data: conv } = await sb
    .from("conversations")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  let title = conv?.title ?? NEW_CHAT_TITLE;
  if (title === NEW_CHAT_TITLE) {
    title = deriveTitle(messages) ?? title;
  }

  // Ensure the conversation row exists (drafts are only persisted here, on the
  // first save) and update its title / updated_at. `folder_id` scopes the chat
  // to a project; only set on insert so it isn't clobbered.
  const row: { id: string; title: string; folder_id?: string } = { id, title };
  if (folderId) row.folder_id = folderId;
  const { error: convErr } = await sb
    .from("conversations")
    .upsert(row, { onConflict: "id" });
  if (convErr) throw new Error(`saveMessages (conversation): ${convErr.message}`);

  const stripped = stripFileBytes(messages);
  const rows = stripped.map((m, i) => ({
    conversation_id: id,
    role: m.role,
    parts: m.parts,
    position: i,
  }));

  const { error: delErr } = await sb
    .from("messages")
    .delete()
    .eq("conversation_id", id);
  if (delErr) throw new Error(`saveMessages (delete): ${delErr.message}`);

  if (rows.length > 0) {
    const { error: insErr } = await sb.from("messages").insert(rows);
    if (insErr) throw new Error(`saveMessages (insert): ${insErr.message}`);
  }
}
