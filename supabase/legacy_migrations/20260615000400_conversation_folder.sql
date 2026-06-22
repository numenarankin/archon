-- 20260615000400_conversation_folder.sql
-- Scope a conversation to a project (folder). NULL = a global
-- chat (the /orion page or the drawer). Lets each project list its own chats.

alter table conversations
  add column folder_id uuid references folders (id) on delete cascade;

create index conversations_folder_idx on conversations (folder_id);
