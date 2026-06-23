# Knowledge Graph Implementation Plan

A plan to make footnotes and cross-document citations ("bridges") a core feature of
the file system, with topic tags, an `@`-mention picker in the editor, a force-directed
graph view, and AI tools that can read and (on explicit request) write these connections.

## Goals

- Footnotes are a first-class part of documents.
- Cite other docs in footnotes or inline with `@`, pointing at a file.
- Typing `@` pops up recommendations so a user can cite a doc without knowing its path.
- These cross-document connections are called **bridges**.
- Project tabs become **Folders** and **Knowledge Graph**.
- **Tags** denote topic areas.
- Tags and bridges are stored in Supabase.
- The AI can read the graph freely, and add bridges/tags **only when explicitly asked**.
- As the corpus grows, the graph makes the AI more effective at finding information.

## Core model

Everything reduces to two relationships layered on the existing `files` table:

- **Bridge**: a directed citation from one doc to another (footnote or inline `@`).
  Source file points at target file.
- **Tag**: a topic label attached to a file, used for filtering and to help the AI
  cluster the corpus.

## Decisions (confirmed)

| Decision | Choice |
| --- | --- |
| When may the AI write bridges/tags? | Only when the user explicitly asks. The AI never volunteers connections while answering. Read tools stay unrestricted. |
| Knowledge Graph rendering | Force-directed graph (nodes = files, edges = bridges, color by tag, click to open). |
| AI-write audit | Every bridge/tag row carries `created_by` (`'user'` or `'ai'`) for auditing and undo. |

## Architecture overview

```
files (existing)
  ├── bridges       source_file_id -> target_file_id   (footnotes / inline @ cites)
  ├── tags          topic labels (unique by slug)
  └── file_tags     files <-> tags (many-to-many)

src/lib/kb/graph.ts          data-access layer (repository functions)
src/lib/ai/tools.ts          add_bridge / add_tag / search_by_tag / get_bridges
src/components/projects/
  markdown-editor.tsx        + @tiptap/extension-mention for the @ picker
  project-workspace.tsx      tabs relabeled to Folders + Knowledge Graph
src/components/kb/
  mention-list.tsx           the @ autocomplete dropdown (Radix popover)
  knowledge-graph-view.tsx   the force-directed graph surface
  editor-toolbar.tsx         + footnote button
```

## 1. Supabase schema

New migration `supabase/migrations/20260623000000_knowledge_graph.sql`, following the
RLS pattern used by every existing table (`for all to authenticated using(true) with check(true)`).

```sql
create table bridges (
  id             uuid primary key default gen_random_uuid(),
  source_file_id uuid not null references files(id) on delete cascade,
  target_file_id uuid not null references files(id) on delete cascade,
  kind           text not null default 'cite' check (kind in ('cite','footnote')),
  anchor         text,            -- footnote marker id or inline span id in the source body
  note           text,            -- optional footnote text
  created_by     text not null default 'user' check (created_by in ('user','ai')),
  created_at     timestamptz not null default now(),
  unique (source_file_id, target_file_id, anchor)
);
create index bridges_source_idx on bridges (source_file_id);
create index bridges_target_idx on bridges (target_file_id);

create table tags (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique
);

create table file_tags (
  file_id    uuid not null references files(id) on delete cascade,
  tag_id     uuid not null references tags(id) on delete cascade,
  created_by text not null default 'user' check (created_by in ('user','ai')),
  primary key (file_id, tag_id)
);
create index file_tags_tag_idx on file_tags (tag_id);

alter table bridges    enable row level security;
alter table tags       enable row level security;
alter table file_tags  enable row level security;
create policy bridges_authenticated   on bridges    for all to authenticated using (true) with check (true);
create policy tags_authenticated       on tags       for all to authenticated using (true) with check (true);
create policy file_tags_authenticated  on file_tags  for all to authenticated using (true) with check (true);
```

Notes:
- Tag creation upserts by `slug`, so `addTag("Royalties")` and `@royalties` resolve to one tag.
- `created_by` is what enables auditing and (optional) review of AI-added connections.

## 2. Data-access layer

New `src/lib/kb/graph.ts`, alongside the existing `src/lib/kb/files.ts` loader. Repository-style functions:

- Bridges: `addBridge`, `removeBridge`, `getOutgoingBridges(fileId)`, `getIncomingBridges(fileId)` (backlinks).
- Tags: `addTag`, `removeTag`, `getFileTags(fileId)`, `searchTags(prefix)`, `getFilesByTag(tagId)`.
- Graph: `getGraph(folderId?)` returns `{ nodes: files, edges: bridges }`, scoped to a project folder when given.

Follows the immutable / explicit-types conventions used across `src/lib`.

## 3. The `@` autocomplete in the editor

The editor is TipTap, configured in `src/components/projects/markdown-editor.tsx`
(the `extensions` array). TipTap's first-party `@tiptap/extension-mention` plus its
suggestion utility gives exactly the "pop up recommendations when a user types @" behavior.

Steps:
1. Add `@tiptap/extension-mention` to the `extensions` array in `markdown-editor.tsx`.
2. Wire `suggestion.items` to a debounced search over file names (a light `files`
   name query, or reuse `searchDocuments`) so a user finds a doc by typing a few
   letters instead of knowing its path.
3. Render the dropdown with `@radix-ui/react-popover` (already a dependency) in a new
   `src/components/kb/mention-list.tsx`.
4. On select: insert a mention node carrying the target `fileId`; render it as a
   clickable chip that opens the target doc.

### Footnotes

- Add a footnote button to `src/components/kb/editor-toolbar.tsx`.
- A footnote that references another doc is a bridge with `kind:'footnote'` and `note` text.
- Plain-text footnotes can remain inline HTML; only cross-doc ones become bridge rows.

### Keeping rows in sync with the body

Bridges stored as rows can drift from the HTML saved in `files.content`. Treat the
editor as the source of truth on save: on commit, parse mention/footnote nodes out of
the committed HTML and reconcile the `bridges` table to match, rather than writing rows
live on every keystroke.

## 4. Tabs: Folders and Knowledge Graph

The project tab strip is the `TABS` array in `src/components/projects/project-workspace.tsx`.

- Relabel the existing `files` tab to **Folders** (it renders the `FileBrowser` folder tree).
- Add a **Knowledge Graph** tab as a sibling, with a matching render block.

```ts
type ProjectTab = "tasks" | "folders" | "knowledge-graph" | "budget";
const TABS = [
  { value: "tasks",           label: "Tasks" },
  { value: "folders",         label: "Folders" },
  { value: "knowledge-graph", label: "Knowledge Graph" },
  { value: "budget",          label: "Budget" },
];
```

### Force-directed graph view

New `src/components/kb/knowledge-graph-view.tsx`, fed by `getGraph(folderId)`:

- Nodes = files, edges = bridges, colored by tag.
- Tag filter rail; click a node to open the doc.
- Dependency: `react-force-graph` (lightest fit for React 19 / Next 16; Cytoscape if
  richer layout control is needed later). This is the only new third-party dependency.
- Dynamic-import with `ssr: false` (the same lesson as TipTap's `immediatelyRender: false`),
  so confirm it renders cleanly under the SSR setup.

## 5. AI permissions and tools

The AI tool registry is `archonTools(folderId?)` in `src/lib/ai/tools.ts`. Mutating tools
use the `needsApproval: true` gate (as `create_document` does today).

New tools:

| Tool | Access | Notes |
| --- | --- | --- |
| `add_bridge({ sourceFileId, targetFileId, kind, note? })` | write | `created_by:'ai'`; only on explicit user request |
| `add_tag({ fileId, tag })` | write | `created_by:'ai'`; only on explicit user request |
| `search_by_tag({ tag })` | read | unrestricted |
| `get_bridges({ fileId })` | read | unrestricted |

Constraints and integration:
- The "explicit request only" rule lives in the persona prompt in
  `src/lib/ai/system-prompt.ts`: the AI calls write tools only when the user directly
  asks ("tag this", "link these two docs"), and never volunteers connections while answering.
- An explicit request is itself the consent. `needsApproval` can be dropped on the write
  tools, or kept for a visible confirmation at no real cost.
- Document the new tools in `TOOL_CATALOG` in `system-prompt.ts`.
- Retrieval payoff: when `searchDocuments` (in `src/lib/ai/retrieval.ts`) returns a hit,
  the AI can follow that file's bridges to pull in cited context. A cheap high-value win
  is folding tags and backlink counts into retrieval ranking.

## Build order

1. **Schema + data layer.** Migration plus `src/lib/kb/graph.ts`. Foundation, testable on its own.
2. **Tabs + graph view.** Relabel tabs; Knowledge Graph view reading real bridge/tag data.
3. **AI tools.** `add_bridge`, `add_tag`, and the read tools wired to the data layer; prompt constraints.
4. **Editor `@` + footnotes.** Mention extension and footnote toolbar. Heaviest UI lift, done
   last so the rest already exercises the schema.

## Open considerations

- Tag taxonomy: free-form vs. a curated list. Free-form (upsert by slug) is simpler to start.
- Bridge directionality in the graph: show backlinks distinctly from outgoing cites.
- Reconciliation cost on large docs: parse-on-save is fine for typical doc sizes; revisit if
  bodies get very large.

## Key existing files referenced

| Purpose | Path |
| --- | --- |
| Files / folders schema | `supabase/migrations/20260621000300_files.sql` |
| Files loader | `src/lib/kb/files.ts` |
| TipTap editor | `src/components/projects/markdown-editor.tsx` |
| Editor toolbar | `src/components/kb/editor-toolbar.tsx` |
| Project tabs | `src/components/projects/project-workspace.tsx` |
| File browser (Folders tab) | `src/components/files/file-browser.tsx` |
| AI tools | `src/lib/ai/tools.ts` |
| AI system prompt | `src/lib/ai/system-prompt.ts` |
| Retrieval | `src/lib/ai/retrieval.ts` |
| Supabase client / server | `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` |
