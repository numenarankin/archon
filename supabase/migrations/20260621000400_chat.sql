-- 20260621000400_chat.sql
-- Archon conversations + messages (persisted server-side). Message file bytes
-- are never stored on a message — attachments are normal `files` rows; the
-- message keeps the AI SDK `parts` (text + file refs) as jsonb.
--
-- `folder_id` scopes a conversation to a project (folder). NULL = a global chat
-- (the /archon page or the drawer).

create table conversations (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references users (id) on delete cascade,
  folder_id  uuid references folders (id) on delete cascade,
  title      text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_folder_idx on conversations (folder_id);
create trigger conversations_set_updated_at
  before update on conversations
  for each row execute function set_updated_at();
alter table conversations enable row level security;
create policy conversations_authenticated on conversations
  for all to authenticated using (true) with check (true);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  role            message_role not null,
  parts           jsonb not null default '[]'::jsonb,  -- AI SDK UIMessage parts
  position        integer not null,                    -- order within the conversation
  created_at      timestamptz not null default now(),
  unique (conversation_id, position)
);
create index messages_conversation_idx on messages (conversation_id, position);
alter table messages enable row level security;
create policy messages_authenticated on messages
  for all to authenticated using (true) with check (true);
