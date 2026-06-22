-- 20260614000600_orion.sql
-- Orion conversations and messages (moved off localStorage). File bytes are
-- never stored on a message — attachments are normal `files` rows linked here.

create table conversations (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references users (id) on delete cascade,
  title      text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger conversations_set_updated_at
  before update on conversations
  for each row execute function set_updated_at();

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  role            message_role not null,
  -- AI SDK UIMessage parts (text + file refs), stored as-is.
  parts           jsonb not null default '[]'::jsonb,
  position        integer not null,           -- order within the conversation
  created_at      timestamptz not null default now(),
  unique (conversation_id, position)
);
create index messages_conversation_idx on messages (conversation_id, position);

-- Which message referenced which file (renders the chip + provenance) -------
create table message_files (
  message_id uuid not null references messages (id) on delete cascade,
  file_id    uuid not null references files (id) on delete cascade,
  primary key (message_id, file_id)
);
create index message_files_file_idx on message_files (file_id);
