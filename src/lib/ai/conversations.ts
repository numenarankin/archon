import type { UIMessage } from "ai";
import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";

export const NEW_CHAT_TITLE = "New chat";
const MAX_TITLE_LENGTH = 48;

/** A saved Archon conversation. Timestamps are epoch ms for easy sorting. */
export interface Conversation {
  id: string;
  title: string;
  messages: UIMessage[];
  createdAt: number;
  updatedAt: number;
}

/** Derive a short title from the first user text message, if any. */
export function deriveTitle(messages: UIMessage[]): string | null {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return null;
  const text = firstUser.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
  if (!text) return null;
  return text.length > MAX_TITLE_LENGTH
    ? `${text.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`
    : text;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: "system" | "user" | "assistant";
  parts: UIMessage["parts"];
  position: number;
}

/** Load all conversations (with their messages), most recently updated first. */
export async function getConversations(): Promise<Conversation[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();

  const { data: convs, error: convErr } = await sb
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (convErr) throw new Error(`getConversations: ${convErr.message}`);
  if (!convs || convs.length === 0) return [];

  const { data: msgs, error: msgErr } = await sb
    .from("messages")
    .select("id, conversation_id, role, parts, position")
    .order("position", { ascending: true });
  if (msgErr) throw new Error(`getConversations: ${msgErr.message}`);

  const byConv = new Map<string, MessageRow[]>();
  for (const m of (msgs ?? []) as MessageRow[]) {
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
      id: m.id,
      role: m.role,
      parts: m.parts ?? [],
    })) as UIMessage[],
  }));
}
