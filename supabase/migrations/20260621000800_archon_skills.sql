-- 20260621000800_archon_skills.sql
-- User-created skills for Archon (the AI assistant). The built-in catalog lives
-- in code (src/lib/archon/skills.ts); this table stores custom skills. Enabled
-- skills are injected into Archon's system prompt so it knows the menu and
-- routes tasks to them. (Read by the chat route via getCustomSkills.)

create table archon_skills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  category    text not null default 'Data'
    check (category in ('Data', 'Documents', 'Analysis', 'Productivity', 'Memory')),
  examples    text[],                          -- example prompts, one per element
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger archon_skills_set_updated_at
  before update on archon_skills
  for each row execute function set_updated_at();
alter table archon_skills enable row level security;
create policy archon_skills_authenticated on archon_skills
  for all to authenticated using (true) with check (true);
