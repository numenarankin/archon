import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";

export interface ChatHistoryHit {
  conversationId: string;
  title: string;
  role: string;
  text: string;
}

interface PartLike {
  type?: string;
  text?: string;
}

function partsToText(parts: PartLike[] | null): string {
  return (parts ?? [])
    .filter((p) => p?.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join(" ");
}

/**
 * Search past conversations for messages matching a query. Lets Archon recall
 * what was discussed in earlier chats ("what did we decide about the SWD
 * permit?"). Simple case-insensitive match over recent history.
 *
 * When `folderId` is given, only this project's conversations are
 * searched — so the project agent recalls its own history, not other projects'
 * or the global chats.
 */
export async function searchChatHistory(
  query: string,
  limit = 10,
  folderId?: string | null
): Promise<ChatHistoryHit[]> {
  if (!hasSupabase() || !query.trim()) return [];
  const sb = await getSupabaseServer();

  let convQuery = sb
    .from("conversations")
    .select("id, title")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (folderId) convQuery = convQuery.eq("folder_id", folderId);
  const { data: convs } = await convQuery;
  if (!convs || convs.length === 0) return [];

  const titleById = new Map(convs.map((c) => [c.id, c.title]));
  const { data: msgs } = await sb
    .from("messages")
    .select("conversation_id, role, parts")
    .in(
      "conversation_id",
      convs.map((c) => c.id)
    )
    .order("position", { ascending: true });

  const needle = query.toLowerCase();
  const hits: ChatHistoryHit[] = [];
  for (const m of msgs ?? []) {
    const text = partsToText(m.parts as PartLike[] | null);
    if (text.toLowerCase().includes(needle)) {
      hits.push({
        conversationId: m.conversation_id,
        title: titleById.get(m.conversation_id) ?? "chat",
        role: m.role,
        text: text.slice(0, 400),
      });
      if (hits.length >= limit) break;
    }
  }
  return hits;
}

export interface ConversationTranscript {
  title: string;
  transcript: string;
}

/**
 * Read one past conversation's full transcript (role-labelled), for when the
 * agent needs the verbatim earlier exchange rather than a snippet. Pairs with
 * search_chat_history, which returns the conversation id.
 */
export async function readConversation(
  conversationId: string
): Promise<ConversationTranscript | null> {
  if (!hasSupabase()) return null;
  const sb = await getSupabaseServer();

  const { data: conv } = await sb
    .from("conversations")
    .select("title")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return null;

  const { data: msgs } = await sb
    .from("messages")
    .select("role, parts, position")
    .eq("conversation_id", conversationId)
    .order("position", { ascending: true });

  const transcript = (msgs ?? [])
    .map((m) => {
      const text = partsToText(m.parts as PartLike[] | null).trim();
      if (!text) return "";
      const who =
        m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : m.role;
      return `${who}: ${text}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return { title: conv.title, transcript };
}
