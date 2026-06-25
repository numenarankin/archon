-- 20260624000200_archon_skills_tools.sql
-- Adds the structured tool allowlist for a skill. The skill editor presents a
-- multi-select of every tool in the registry (src/lib/ai/tools.ts); the chosen
-- tool names are stored here as the skill's allowlist. The markdown body says
-- how/when to use the skill; this array says what it may call. Read when scoping
-- tools at runtime and when regenerating the Skills.md menu.
--
-- Also stores the full markdown body for a skill. The existing description column
-- stays as the short, one-line summary surfaced in the skills table and the menu.

alter table archon_skills
  add column tool_names text[] not null default '{}',
  add column content    text not null default '';
