-- 20260615000700_orion_skills.sql
-- User-created skills for Orion (the AI assistant). The built-in skill catalog
-- lives in code (src/lib/orion/skills.ts); this table stores the custom skills
-- the team defines on the Skills page. Enabled skills are injected into Orion's
-- system prompt so it knows the menu and routes tasks to them automatically.

create table orion_skills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  category    text not null default 'Data'
                check (category in ('Data', 'Documents', 'Analysis', 'Productivity', 'Memory')),
  examples    text[],                                -- example prompts, one per element
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger orion_skills_set_updated_at
  before update on orion_skills
  for each row execute function set_updated_at();
