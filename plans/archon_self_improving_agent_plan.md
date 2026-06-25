# Archon Self-Improving Agent — Architecture Plan

## Goal

Evolve Archon from a hardcoded-prompt agent into a **self-improving agent** whose
behavior is defined by six user-editable markdown documents. After each turn, a
background reflection task updates the agent's memory, soul, and the user's persona
"only if necessary," so the agent improves based on user feedback.

This externalizes today's prompt assembly (currently TypeScript constants in
`src/lib/ai/system-prompt.ts` and `src/lib/archon/skills.ts`) into editable docs and
adds a post-turn reflection loop.

---

## The document model

Six context docs, resolved **system default → org override → user override**, composed
into the system prompt each turn:

```
Harness.md   (user-editable, AGENT-LOCKED)            ← safety / anti-injection
App.md       (system default + live manifest appended) ← what the app is
Soul.md      (user-editable, agent-writable)           ← personality, background, telos
Persona      (user-editable, agent-writable)           ← who the USER is
Skills.md    (AGENT-GENERATED menu, derived from individual skill docs)
Memory.md    (working memory, capped; agent-writable)
+ pageContext + projectContext (unchanged, dynamic)
```

### Mapping to existing code

| New doc      | Replaces / absorbs                          | Today's location |
|--------------|---------------------------------------------|------------------|
| Soul.md      | `ARCHON_PERSONA`                            | `src/lib/ai/system-prompt.ts` |
| App.md       | `TOOL_CATALOG` + `DATA_LAYOUT` + manifest   | `src/lib/ai/system-prompt.ts`, `src/lib/ai/manifest.ts` |
| Skills.md    | `ARCHON_SKILLS` + custom skills             | `src/lib/archon/skills.ts`, `src/lib/archon/skills-store.ts` |
| Harness.md   | safety rules embedded in the persona        | `src/lib/ai/system-prompt.ts` |
| Memory.md    | `recall_memory` / `agent_memory` (RAG → in-context) | `src/lib/ai/memory.ts` |
| Persona      | `getProfile()` name/company                 | profile fetch in `src/app/api/chat/route.ts` |

---

## Decisions (locked)

1. **Harness.md = user-editable, agent-locked.** Users can fully edit it in AI settings;
   the reflection loop can never change it.
2. **Self-edits auto-apply.** Soul / Persona / Memory updates apply silently with no
   approval prompt. Revision history + rollback is the safety net.
3. **Memory = hybrid.** Memory.md injected in full each turn (size-capped + compacted);
   long-tail facts overflow to the existing pgvector `agent_memory` store, recalled via
   the `recall_memory` tool.

### Editability matrix

| Doc      | User edits? | Reflection loop edits? |
|----------|-------------|------------------------|
| Harness         | full        | never (agent-locked)   |
| App             | admin/system| no                     |
| Skills (each)   | full        | no                     |
| Skills.md (menu)| derived     | regenerated on save (see Skills subsystem) |
| Soul            | yes         | yes (auto-apply)       |
| Persona         | yes         | yes (auto-apply)       |
| Memory          | yes         | yes (auto-apply)       |

The agent-lock is **structural**: the **conversational reflection loop**'s output schema
has no field for harness/app/skills, so it cannot emit a change to them regardless of
conversation input. Skills.md is written only by a separate skill-menu regeneration task
(triggered by skill CRUD, not by chat), so the reflection-loop guarantee is unaffected.

---

## Storage

This install is **single-tenant** (`profile` is a literal singleton, `users` is optional
with nullable FKs), so the original system→org→user override model is dropped in favor of
**one singleton row per doc**, mirroring `profile` / `project_memory`.

- **`agent_context_docs`** — `(doc_type PK, content, version, updated_by, last_edit_rationale, updated_at)`
  - `doc_type`: `soul | app | harness | skills | memory | persona` (also the primary key)
  - `updated_by`: `user | agent | system`
  - Triggers: `bump_context_version` (BEFORE UPDATE, bumps version + `updated_at` on content
    change) and `log_context_revision` (AFTER INSERT/UPDATE, mirrors each version into the
    revision log). Auditing is enforced at the DB layer so no edit escapes it.
- **`agent_context_revisions`** — append-only history per doc with `rationale` and
  `updated_by`. Load-bearing: since self-edits auto-apply with no approval gate, this log +
  one-click rollback is the only safety net. Settings UI shows a per-doc diff timeline.

Seeded defaults ship in the migration (em-dash-free), ported from today's
`ARCHON_PERSONA` (→ soul), the safety block (→ harness), and `DATA_LAYOUT` (→ app). The
exact tool list is **not** seeded into `app`; it is generated from the tool registry and
appended at runtime (same catalog as the skills tool-picker), so it never drifts from
`src/lib/ai/tools.ts`.

Implemented in `supabase/migrations/20260624000100_agent_context.sql`. The skills
tool-allowlist + full markdown body columns are added to `archon_skills` in
`20260624000200_archon_skills_tools.sql`.

---

## Skills subsystem (two-tier)

Skills are split into the individual skill docs the user authors and the condensed menu
the agent reads.

- **Individual skill docs** — one full markdown doc per skill, stored in the existing
  `archon_skills` table (`id, owner_id, name, content, enabled, updated_at`). These are
  the source of truth, authored and owned entirely by the user.
- **Skills.md (the menu)** — an **agent-generated**, very succinct summary listing each
  enabled skill with a one-line description of what it does and when to use it. This is
  what gets injected into the system prompt each turn; the agent picks from the menu, then
  (optionally) the full skill body is loaded on demand when a skill is selected, keeping
  context lean.

### Editing flow

1. **Skills table** in AI settings: every skill as a row (name + short description +
   enabled toggle). Click a row to open it.
2. **Click-to-edit:** opens the skill's full markdown in an editor.
3. **Create new skill:** a button opens a blank markdown editor; on save, inserts a new
   `archon_skills` row.
4. **On any save / edit / delete / toggle:** fire a **background** task where Archon
   regenerates Skills.md — re-summarizing the current set of enabled skills into the
   succinct menu. Same `after()` background pattern as the reflection loop; never blocks
   the UI. Uses the strong model for summary quality, with prompt-cache reuse.

### Notes

- Skills.md is **derived state** — users edit skills, not the menu. Hand-edits to the menu
  would be overwritten on the next regeneration, so the settings UI does not expose
  Skills.md as a directly editable doc (optionally read-only preview).
- Tool *bindings* stay in code (`src/lib/ai/tools.ts`). A skill doc references tool names;
  it does not define tools.
- **Tool selection via dropdown.** The create/edit modal includes a multi-select of all
  available tools so the user picks which ones a skill may use — a structured allowlist,
  not tool names parsed from prose. Details:
  - Option list is **derived from the tool registry** (each tool's name + existing
    description via a `getToolCatalog()` helper), so the picker can never drift from the
    real tools.
  - Stored as a `tool_names text[]` column on the `archon_skills` row. Markdown body = the
    *how/when*; the array = the *what it can call*.
  - At runtime the array is a precise allowlist for scoping tools passed to `streamText`
    when the skill is in play (vs. inferring from text). Skills.md regeneration also reads
    the array verbatim, so the menu states each skill's tools accurately.
  - Project-scoped tools (`archonTools(folderId)` only exposes `create_document` etc.
    inside a folder) appear in the dropdown but are labeled project-only; selecting one is
    a no-op outside a project.
- Regeneration is idempotent and debounced: rapid successive saves collapse to one rebuild.

## Prompt assembly changes

In `src/app/api/chat/route.ts` (and `voice-chat/route.ts`), replace "concatenate
hardcoded constants" with:

1. Load the six docs for `(user, org, folder)` with override resolution.
2. Append the live manifest under App.md (App.md = static description, manifest = live state).
3. Inject Memory.md in full.
4. Concatenate with pageContext + projectContext.

Tool definitions stay in code (`src/lib/ai/tools.ts`). Skills.md is the routing menu that
references tool names; it does not redefine tools.

---

## Reflection loop (self-improvement)

Runs post-stream, non-blocking via `after()` from `next/server` (generalizes today's
`refreshProjectMemory()`).

1. **Inputs:** completed turn (user msg + assistant response + tool calls) + current
   Soul / Persona / Memory.
2. **One structured-output call** → `{ memory, soul, persona }`, each
   `{ shouldUpdate: boolean, newContent?: string, rationale: string }`. Most turns →
   all `false` (the "only if necessary" gate).
3. **Auto-apply** any `shouldUpdate: true`: write content, bump version, log revision.
4. **Injection guard:** the reflector must treat tool results / document content as
   untrusted data, never instructions. With auto-apply there is no human in the loop, so
   this is the highest-care item — a malicious doc must not be able to rewrite Soul/Persona.
5. **Compaction:** when Memory.md exceeds its cap (~6–8KB), summarize and evict
   older/long-tail facts into the pgvector `agent_memory` store.

### Cost & model choice

Cost/latency is **not** a real constraint here, so use the strongest model (Opus), not a
cheaper one — the reflector decides what gets written into Soul/Memory permanently, so a
weak judgment compounds across every future turn. Why it stays cheap regardless:

- **Background execution** (`after()`) keeps it off the critical path — zero UX latency.
- **Prompt caching:** run immediately after the response, the reflection call reuses the
  same warm cached prefix as the chat call (same six docs + manifest + tool defs), so the
  full system prompt comes in at the cache discount. Only the short reflection instruction
  + small output pay full price.
- **Narrow task = tiny output:** Soul/Memory are already in context, so the job is just
  "did this turn contain feedback or a new fact warranting an edit?" The common answer is
  no → `shouldUpdate: false` across the board → trivial output. Catch both *explicit*
  feedback and *implicit* signal (corrections, restated preferences, new user facts).

**Caching subtlety:** keep the *same* system + tools block as the chat call and steer the
reflection task via the appended turn (tool use disabled). Constructing a lean bespoke
reflector prompt moves the cache breakpoint and busts the hit.

### Staleness & concurrency

- **Staleness race:** if the user sends turn N+1 before reflection finishes, it uses
  pre-update memory. Usually fine (eventual consistency); only bites on "remember X" →
  immediately "what is X". Acceptable; optionally await in-flight reflection before
  starting a new turn.
- **Concurrency:** two quick turns could reflect simultaneously and clobber writes. Use
  version-checked optimistic writes (reject stale → re-read → retry) or serialize
  reflection per user.

---

## Settings UI

In AI settings:
- Markdown editor per doc: Harness, App, Soul, Persona, Memory. (Skills.md is derived —
  shown read-only at most.)
- **Skills table:** rows of `name + short description + enabled toggle`; click a row to
  edit its full markdown; a **Create new skill** button opens a blank markdown editor.
  Saving any skill triggers background Skills.md regeneration.
- Per-doc revision timeline with diffs and one-click rollback (critical for auto-applied
  self-edits).
- Indicator of which scope (system/org/user) is currently in effect.

---

## Open / future considerations

- Whether App.md stays partly auto-generated from the manifest to avoid drift from reality.
- Reflection model selection + triggering heuristics (every turn vs. informative turns vs.
  every N turns).
- Memory.md cap value and compaction cadence.
- Org-level vs. user-level defaults for Harness/App.

---

## Build order & status

1. **Storage layer** — DONE. `20260624000100_agent_context.sql` (docs + revisions +
   triggers + seeds) and `20260624000200_archon_skills_tools.sql` (`tool_names`, `content`).
2. **Prompt-assembly refactor** — DONE. `lib/ai/context/{defaults,docs}.ts` (resilient
   loader), `lib/ai/tool-catalog.ts` (catalog from the registry), `assembleSystemPrompt`
   in `lib/ai/system-prompt.ts`; chat + voice routes now assemble from docs. Dead
   `prompts/skills.ts` removed.
4. **Skills subsystem** — DONE (backend + modal). `lib/archon/skills-menu.ts`
   (deterministic menu with a model fallback for long bodies), skill actions extended with
   `content` + `toolNames` and background `regenerateSkillsMenu()`, `listToolCatalog`
   action, and the skill modal now has a markdown body + tool-picker multi-select.
5. **Reflection loop** — DONE. `lib/ai/reflection.ts` (`generateObject`, schema covers
   only memory/soul/persona, injection guard, auto-apply), wired into both routes via
   `after()` in `onFinish` so it runs in the background off the response path.
3. **Settings UI** — DONE. New "Archon" tab in `SettingsWorkspace` (mounted +
   data loaded in `app/settings/page.tsx`): `ArchonSection` renders the skills table
   (now with markdown body + tool-picker in `SkillModal`) plus `ContextDocEditor` for all
   six docs, each with Save, a revision timeline, and one-click restore (context-doc
   server actions in `lib/ai/context/actions.ts`).
6. **Memory compaction + vector overflow** — DONE. Hard `MEMORY_CHAR_CAP` (3000 chars)
   enforced in `reflection.ts` via `enforceMemoryCap` (truncate backstop); the reflector
   returns an `archive[]` of evicted facts that are embedded into the pgvector
   `agent_memory` store (`rememberFact(fact, "inferred")`) so compaction is lossless and
   archived facts stay searchable via `recall_memory`. The document corpus RAG
   (`document_chunks` / `search_documents`) is a separate store, untouched.

Note: one pre-existing lint error in `lib/ai/use-voice-conversation.ts` (setState-in-effect)
is unrelated to this work. All files touched here pass `tsc --noEmit` and `eslint`.
