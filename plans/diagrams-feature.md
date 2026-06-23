# Plan: Diagrams feature — draw on a canvas, Archon reads and writes them

## Goal

Let a user create and edit diagrams on an infinite canvas (tldraw), stored as
first-class files in the existing file tree, with **"New Diagram"** sitting
right next to "New Folder" / "New Doc" on the **Files** page and inside the
**Add file** menu on the **Projects** page.

**There is no standalone Diagrams page and no sidebar entry.** A diagram is a
file that lives in the folder where it was created, exactly like a doc. It opens
**inline** in that folder's context (the file browser on Files, the workspace
main panel on Projects), the same way `DocumentEditor` / `MarkdownEditor` open a
doc today. It is never a separate destination.

Critically, Archon understands diagrams the same way it understands every other
file: through structured text and tools, never as opaque pixels. Two directions:

- **Read:** Archon can answer questions about a diagram, search across diagrams,
  and resolve "this diagram" on the diagram page.
- **Write:** Archon can generate a diagram from a prompt or, the headline use
  case, **from an uploaded photo of a whiteboard/sketch, in a few seconds.**

## The core design decision

A diagram is stored as a **structured shape-graph (JSON)**, not a raster image.
Every channel Archon uses to perceive the app reads structure, not pixels:

- Tools that return structured data (`read_file`, `describe_dataset`, `search_documents`)
- RAG embeddings of a file's *text* (`embedFile`)
- The system-prompt manifest
- Page context (route + selection)

So a diagram follows the exact pattern structured data files already use
(`src/lib/kb/structured.ts`): keep the raw source of truth, plus a cached
**text/JSON summary** the model reads, while heavy data is re-derived on demand
and never embedded raw. tldraw is the right editor because it gives a freeform
drawing feel while every shape remains a typed, labeled record we can serialize.

## Data model — reuse the `files` table

A diagram is a new file **type**, not a new table, so it inherits placement,
search, project scoping, move/rename, and the breadcrumb UI for free.

### Migration: `supabase/migrations/202606XXXXXX_diagrams.sql`

The `files.type` column has a CHECK constraint
(`'pdf','doc','md','note','image','transcript','url'` in
`20260621000300_files.sql`). Extend it:

```sql
alter table files drop constraint files_type_check;
alter table files add constraint files_type_check
  check (type in ('pdf','doc','md','note','image','transcript','url','diagram'));
```

No new columns are needed. Existing columns carry everything:

| Column               | Holds for a diagram                                                        |
| -------------------- | ------------------------------------------------------------------------- |
| `type`               | `'diagram'`                                                               |
| `content`            | tldraw store snapshot JSON (the **source of truth**)                      |
| `derived_content`    | generated **text description** of the graph (embedded + LLM-legible)      |
| `structured_summary` | compact `{ nodes, edges, groups }` JSON for the read tool                 |
| `storage_key`        | exported PNG/SVG thumbnail (previews + vision fallback)                   |
| `derived_at`         | when the description/summary were last regenerated                        |

## Library

Add `tldraw` (and `@tldraw/tldraw` styles). One transitive concern: tldraw ships
its own CSS and expects a sized container, so the editor must be a client
component mounted in a flex/absolute-positioned box. Lazy-load it with
`next/dynamic({ ssr: false })`, matching how `folder-workspace.tsx` already
dynamically imports `file-preview`.

For Archon-authored layout, add `dagre` (or `@dagrejs/dagre`) to position
node/edge specs deterministically so the model never emits coordinates.

---

## Part 1 — Drawing (the editor)

### 1a. Server actions: `src/lib/diagrams/actions.ts`

Mirror `createDoc` in `src/lib/files/actions.ts` exactly (insert into `files` +
`file_placements`, then `revalidatePath`).

```ts
// Create an empty diagram in a folder; returns its id.
export async function createDiagram(
  folderId: string,
  name = "Untitled.diagram"
): Promise<{ id: string }>;

// Save the canvas snapshot, regenerate description + summary + thumbnail,
// re-index for search. The diagram analogue of saveDoc().
export async function saveDiagram(
  fileId: string,
  snapshot: unknown        // tldraw store JSON
): Promise<void>;

// Read a diagram's snapshot + summary for the editor / tools.
export async function getDiagram(
  fileId: string
): Promise<{ id: string; name: string; snapshot: unknown; summary: DiagramGraph } | null>;
```

`saveDiagram` is the heart of the read story. On every (debounced) save it:

1. writes `content` = snapshot,
2. calls the serializer (Part 2) to compute `structured_summary` + `derived_content`,
3. uploads a PNG export to `storage_key`,
4. calls `embedFile(fileId)` so `search_documents` finds it (same as `saveDoc`,
   `src/lib/files/actions.ts:191`).

### 1b. The editor opens inline — no route

A diagram does **not** get its own route. It opens inline in whichever surface
the user is already in, mirroring how docs open today:

- **Files page** (`file-browser.tsx`): the browser already swaps its main render
  to `DocumentEditor` / `DocumentViewer` when a file is being viewed (`viewing`
  state). Add a branch: when the opened file is `type === "diagram"`, render
  `<DiagramCanvas>` instead. Closing it returns to the same folder listing.
- **Projects page** (`folder-workspace.tsx`): the workspace main panel already
  switches between `MarkdownEditor` and `FilePreview` based on the selected
  file. Add a `DiagramCanvas` branch for diagram files.

This keeps the diagram firmly "in its folder" — the breadcrumb, the surrounding
file list, and the project chat context all stay put. (If a shareable deep link
is ever wanted, a thin `/files?file=<id>` style query param that auto-opens the
inline editor is preferable to a separate `/diagrams` route, so the folder stays
the home.)

### 1c. Canvas component: `src/components/diagrams/diagram-canvas.tsx`

- `"use client"`, dynamic import of tldraw, `ssr: false`.
- Holds the editor instance; subscribes to store changes.
- **Debounced autosave** (~800ms idle), calling `saveDiagram`, exactly like
  `MarkdownEditor`/`saveDoc` debounce in `folder-workspace.tsx:196`.
- Optional Zustand store `useDiagramAiContext` (mirroring `useMapAiContext` in
  `src/lib/ai/map-context.ts`) holding the open diagram's `{ id, name, summary }`
  so page context can read it without prop drilling.

### 1d. The buttons (the explicit ask)

**Files page** — `src/components/files/file-browser.tsx` (~line 315). There is a
button row: `New Folder`, `New Doc`, `Upload File`. Add a third outline button
between New Doc and Upload File:

```tsx
<Button size="lg" variant="outline" onClick={handleCreateDiagram}>
  <PenLineIcon />   {/* or Workflow / Shapes icon from lucide */}
  New Diagram
</Button>
```

`handleCreateDiagram` mirrors `handleCreateDoc` (`file-browser.tsx:147`): call
`createDiagram(current.id)`, `router.refresh()`, then open the new diagram
**inline** by setting the `viewing` state to the new file (the browser already
swaps in `DocumentEditor`/`DocumentViewer`; add a `DiagramCanvas` branch for
`type === "diagram"`). No navigation — it stays in `current` folder.

**Projects page** — `src/components/projects/folder-workspace.tsx` (~line 297).
The "Add file" button opens a dropdown with *Upload from device / Add from files
/ New note*. Add a fourth item:

```tsx
<button type="button" onClick={() => { setMenuOpen(false); handleNewDiagram(); }} ...>
  <PenLineIcon className="size-4 text-tertiary-text" />
  New diagram
</button>
```

`handleNewDiagram` mirrors `handleNewNote` (`folder-workspace.tsx:217`): call
`createDiagram(folderId)`, refresh the tree, select/open it. The project file
tree (`file-tree.tsx`) needs a diagram icon + click handler that opens the
canvas in the workspace's main panel instead of `MarkdownEditor`/`FilePreview`.

### 1e. Icons / type plumbing

- `src/lib/kb/types.ts`: add `'diagram'` to `KBFileType`.
- Wherever file `type` maps to an icon/label (file table rows, file tree),
  add a diagram case so it renders with a sensible icon and "Diagram" label.

---

## Part 2 — Archon reads diagrams

### 2a. The serializer: `src/lib/diagrams/describe.ts`

This is the single most important file. It turns a tldraw snapshot into two
artifacts.

**(i) A normalized graph** (`structured_summary`):

```ts
interface DiagramGraph {
  title: string;
  nodes: { id: string; label: string; shape: "box" | "diamond" | "ellipse" | "text" }[];
  edges: { from: string; to: string; label?: string; dir: "->" | "--" }[];
  groups: { label: string; nodeIds: string[] }[];  // tldraw frames / containment
}
```

Build it by walking tldraw shapes: `geo`/`text` shapes become nodes (label from
their text), `arrow` shapes become edges (resolve `from`/`to` from arrow
**bindings**, not pixel endpoints), `frame` shapes and spatial containment
become groups.

**(ii) A compact markdown description** (`derived_content`) for embedding +
the read tool:

```
Diagram "Lease Acquisition Flow" — 6 nodes, 5 connections.
Nodes: [Title Search] (box), [Due Diligence] (box), [Drill?] (diamond), [Pass] (box), [Sign Lease] (box)
Flow:
  Title Search -> Due Diligence -> Drill?
  Drill? --no--> Pass
  Drill? --yes--> Sign Lease
Groups: "Legal" contains { Title Search, Due Diligence }
```

This converts spatial layout into explicit relationships (direction, arrow
labels, containment) — which is what makes the diagram "intuitive" to a text
model. Keep it compact; it is what gets embedded and what the tool returns.

### 2b. New read tool: `read_diagram(fileId)`

In `src/lib/ai/tools.ts`, alongside `read_file` / `describe_dataset`:

```ts
read_diagram: tool({
  description:
    "Read a diagram by its file id — returns its title, nodes, the connections " +
    "between them (with direction and labels), and any groups. Use for any " +
    "question about a flowchart, process, org chart, or sketch the user drew.",
  inputSchema: z.object({ fileId: z.string() }),
  execute: async ({ fileId }) => ({ diagram: await getDiagramSummary(fileId) }),
}),
```

It returns `structured_summary` + the markdown description. For a freeform
sketch the graph can't fully capture, also attach the exported PNG
(`storage_key`) as an image part — the model is `claude-opus-4-8` (multimodal),
so the structured text is primary and cheap, and the image is the safety net.

### 2c. Wire it into the prompt surfaces (keep these in sync — the files say so)

- **`src/lib/ai/system-prompt.ts`**: add `read_diagram` to `TOOL_CATALOG` under
  "Files & documents", and add a line to `DATA_LAYOUT` ("Diagrams: node/edge
  canvases; read their structure with `read_diagram`, searchable once indexed").
- **`src/lib/archon/skills.ts`**: add a "Diagrams" skill (category Documents,
  tools `["read_diagram", "search_documents"]`, plus the action tools below)
  with example prompts so it surfaces on the Skills page.
- **`src/lib/ai/page-context.ts`**: extend `AiSelection` with `kind: "diagram"`
  (it already carries `file`/`folder`/`well`). Since diagrams open inline, the
  page route stays `/files` or the project route — what changes is the
  **selection**. When a diagram is the open file, set the selection to that
  diagram (id + title) so "this diagram" resolves to a `read_diagram` call,
  exactly how an open file or selected well is injected today. No new route case
  is needed in `describePage` beyond labeling the selected diagram.

Because `derived_content` is embedded by `embedFile`, diagrams become findable
through the existing `search_documents` with **no extra retrieval wiring**.

---

## Part 3 — Archon writes diagrams (incl. photo → diagram)

### 3a. The compiler: `src/lib/diagrams/compile.ts`

The inverse of the serializer. Takes a semantic `DiagramGraph` spec, runs it
through **dagre** for layout, and emits a valid tldraw snapshot. The model
supplies *nodes, edges, labels, groups* only — never coordinates — so the output
is always clean and aligned. This is what makes generation fast and reliable.

### 3b. Action tools (gated by the existing approval prompt)

In `src/lib/ai/tools.ts`, alongside `create_task` / `create_document`:

```ts
create_diagram: tool({
  description:
    "Create a new diagram from a structured spec (nodes + connections + groups). " +
    "Use when the user asks you to draw, chart, or map out a process/flow/structure, " +
    "or to turn an uploaded photo of a sketch into an editable diagram.",
  inputSchema: z.object({
    name: z.string(),
    folderId: z.string().optional(),     // defaults to current project / files root
    spec: DiagramSpecSchema,             // zod: { nodes, edges, groups }
  }),
  execute: async ({ name, folderId, spec }) =>
    ({ id: await createDiagramFromSpec(name, folderId, spec) }),
}),

edit_diagram: tool({
  description: "Modify an existing diagram: add/rename/remove nodes or connections.",
  inputSchema: z.object({ fileId: z.string(), ops: DiagramOpsSchema }),
  execute: async ({ fileId, ops }) => ({ ok: await applyDiagramOps(fileId, ops) }),
}),
```

Both ride the existing per-action approval UI (the system prompt already tells
Archon every action tool is user-approved before it runs, like `create_task`).
`create_diagram` reuses `createDiagram` + `compile.ts` + `saveDiagram`, so the
new file is immediately indexed and openable.

### 3c. The photo → diagram flow (headline)

1. **Image in.** Allow image attachments in the Archon drawer. The chat already
   speaks multimodal (`UIMessage` image parts; model is `claude-opus-4-8`), and
   the app already ingests images elsewhere (`src/lib/ai/ocr.ts`, the
   `accounting/extract` route), so this is a UI affordance, not new plumbing.
2. **Vision → spec, not pixels.** Archon reads the photo and emits a
   schema-constrained `DiagramSpec` (`{ nodes, edges, groups }`). Its only job
   is recognition: which boxes, which labels, what points to what — which vision
   does well in one pass. Zod validation on the tool input forces a retry on a
   malformed spec.
3. **Deterministic layout.** `create_diagram` runs the spec through dagre →
   clean tldraw snapshot. Seconds, no fiddling.
4. **Approve + open.** User approves the action, lands in an editable canvas.
   Keep the original photo attached (`storage_key` of a sibling image file, or a
   note in the diagram) so they can eyeball the result against the source, and
   correct via `edit_diagram` rather than redrawing.

Because the output is the same structured graph as a hand-drawn one, the photo
result is instantly searchable, re-readable by Archon, and hand-editable.

---

## Build order

1. **Migration** — extend `files_type_check` with `'diagram'`.
2. **Editor + buttons** — `createDiagram`/`saveDiagram`/`getDiagram`,
   `DiagramCanvas` opened inline (Files `viewing` branch + Projects main-panel
   branch), the New Diagram button on Files and the Add-file menu item on
   Projects, type/icon plumbing. *Drawing works, no AI.*
3. **Serializer + indexing** — `describe.ts`, wire into `saveDiagram` (summary +
   description + `embedFile`). *Diagrams become searchable.*
4. **read_diagram + prompt wiring** — tool, `TOOL_CATALOG`, `DATA_LAYOUT`,
   skill, page context. *Archon reads diagrams.*
5. **Vision fallback** — attach PNG in `read_diagram` for messy sketches.
6. **compile.ts + create_diagram/edit_diagram** — *Archon draws diagrams.*
7. **Photo → diagram** — image attachments in the drawer; verify end to end.

## Files touched (summary)

**New**
- `supabase/migrations/202606XXXXXX_diagrams.sql`
- `src/lib/diagrams/{actions,describe,compile,types}.ts`
- `src/components/diagrams/diagram-canvas.tsx`
- (optional) `src/lib/ai/diagram-context.ts` (Zustand, like `map-context.ts`)

*(No `src/app/diagrams/**` route — the canvas opens inline in its folder.)*

**Edited**
- `src/components/files/file-browser.tsx` (New Diagram button + inline `viewing` branch)
- `src/components/projects/folder-workspace.tsx` (Add-file menu item + main-panel branch)
- `src/components/projects/file-tree.tsx` (diagram icon + inline open handler)
- `src/lib/kb/types.ts` (`KBFileType += 'diagram'`)
- `src/lib/ai/tools.ts` (`read_diagram`, `create_diagram`, `edit_diagram`)
- `src/lib/ai/system-prompt.ts` (`TOOL_CATALOG`, `DATA_LAYOUT`)
- `src/lib/ai/page-context.ts` (`AiSelection`, `describePage`)
- `src/lib/archon/skills.ts` (Diagrams skill)

## Open questions / risks

- **tldraw bundle size + SSR.** Must be client-only, lazy-loaded; verify it does
  not bloat the Files page initial load (it should only load when a diagram opens).
- **Snapshot schema churn.** tldraw store format can change across major versions;
  pin the version and store the tldraw schema version alongside `content` so old
  diagrams can be migrated.
- **Serializer fidelity.** Arrow→node resolution depends on tldraw *bindings*;
  unbound free arrows need a nearest-shape heuristic, and that loss is exactly
  what the PNG vision fallback covers.
- **Skill gating.** Skill enablement is currently local UI state
  (`src/lib/archon/skills.ts` notes this); the diagram action tools are always
  handed to the model until that is wired to a persisted gate.
- **Folder default for `create_diagram`.** When Archon creates a diagram outside
  a project, decide the target folder (files root vs a "Diagrams" system folder).
