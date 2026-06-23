# Network View: Knowledge-Graph Prospecting Map

## 1. Goal

Add a third view to the Map page, alongside **Wells** and **Operators**, called **Network**.

It renders a force-directed knowledge graph (the style of the reference screenshot, but on the app's light canvas) of the relationships between **operators** and the **people** on their P-5 filings (officers, principals, filing agents, resident Texas agents).

The business purpose is **prospecting**. Customer value scales linearly with an operator's well count, and a person who connects many operators (a filing agent like "Palmour, Vicki" with 199 affiliated operators) is a high network-value node: a channel to reach many prospects at once. The graph lets us see the hubs, see the operator clusters hanging off them, and hypertarget both the big operators and the connectors. It also directly answers the question that started this ("which filing agents handle the most volume in Texas?"), which the current operator-only tools cannot.

## 2. What the data supports

Grounded in the existing schema (`supabase/migrations/20260621001000_wells_operators.sql` and `20260622000400_operator_contacts.sql`):

| Concept | Source | Notes |
|---|---|---|
| Operator node | `operators` (PK `operator_number`) | name, `p5_status` (A/I/D/S), city/state |
| Person node | `operator_officers.officer_name` | denormalized; identity is the exact name string |
| Affiliation edge | `operator_officers` row | carries `officer_title` (role) + `officer_city/state` |
| Operator status on edge | `operators.p5_status` | Active / Inactive / Delinquent |
| Well count (node weight) | `count(*)` over `well_operator` by `operator_number` | computed today, not stored |
| Enriched person identity | `operator_contacts.person_key` | better identity, but only covers the enriched subset |

Key facts that shape the design:

- The graph is naturally **bipartite**: people on one side, operators on the other, edges = affiliations. We do **not** draw person-to-person edges directly. An operator with 10 officers would otherwise create 45 person-to-person edges; bipartite keeps it linear and is a truer representation of the data.
- **Person identity is the exact `officer_name` string.** This is what `getPrincipalDetail` already relies on ([queries.ts:347](../src/lib/wells/queries.ts#L347)), and it is what produces the "AFFILIATED OPERATORS (199)" count in the principal panel. Good enough for v1. `operator_contacts.person_key` is a better cross-operator identity but only exists for enriched contacts, so we note it as a future upgrade, not a v1 dependency.
- **Well count is the operator node weight** (customer value). **Degree (number of affiliated operators) is the person node weight** (network value).

## 3. Graph model

**Nodes**
- Operator nodes: id = `op:<operator_number>`, size = f(well count), label = operator name.
- Person nodes: id = `pn:<officer_name>`, size = f(degree = affiliated operator count), label = officer name.

**Edges**
- One edge per affiliation: person -> operator, attributes `{ title, p5_status }`.

**Visual encoding (light canvas)**
- Node radius: square-root scale of the weight (sqrt keeps area proportional, avoids giant blobs). Operators by well count, people by degree.
- Node color: by node type first (operator vs person), with an optional recolor mode by `p5_status` (active/inactive/delinquent) or by `officer_title` family (filing agent, resident agent, officer/principal). Use the app's existing palette / design tokens, not the screenshot's neon.
- Edge color/weight: light gray, thin; optionally tint by role.
- Hub emphasis: people above a degree threshold get a label and a subtle ring so the connectors stand out.

## 4. The scale problem and the strategy

We must not dump the entire statewide graph. Texas P-5 data is tens of thousands of operators and a comparable number of distinct officer names; a single hub (Palmour) alone touches 199 operators. A faithful statewide bipartite graph is hundreds of thousands of nodes/edges, which kills both layout quality and browser performance, and is useless for prospecting (an undifferentiated hairball).

**Strategy: scoped, seed-and-expand subgraphs.** The Network view always shows a focused neighborhood, never the whole state:

1. **Top hubs (default entry):** show the top N people ranked by network value (degree, or by summed well volume of their operators), plus the operators they connect. This is the "biggest filing partners" view and the prospecting starting point.
2. **Seed by operator:** pick an operator, show it, its people, and (one hop further) the other operators those people connect to. This reveals "who else does my prospect's filing agent serve."
3. **Seed by person:** pick a filing agent / principal, show their full operator cluster (the Palmour 199 case, capped/paged).
4. **Seed by county or district:** operators in a county plus their shared people, to find local clusters.

Each scope is bounded (cap nodes at, say, 300 to 800, matching the screenshot's comfortable density) with a "load more / expand node" affordance. Clicking a node expands its neighbors on demand rather than pre-loading everything.

**Step 0 of implementation is a counting query** to confirm actual cardinalities (distinct operators, distinct officer names, max/percentile degree) so the caps and defaults are set from real numbers, not guesses.

## 5. Rendering technology

Already in `package.json`: `d3-array`, `d3-scale`, `d3-selection`, `d3-zoom`, `d3-shape`, `@dagrejs/dagre` (unused). **Not** present: `d3-force` or any graph renderer.

**Recommendation: `react-force-graph-2d`** (wraps `d3-force` + HTML5 Canvas, with built-in zoom/pan via `d3-zoom`, hover, click, and custom node/link paint). Rationale:
- Canvas rendering handles the 300 to ~2000 node range smoothly (SVG/d3-DOM does not).
- Gives us the force simulation, zoom, drag, and hit-testing for free, so we write paint + interaction callbacks, not a physics engine.
- The 2D build avoids the three.js weight of the 3D variants.
- Matches the user preference for battle-tested libraries over hand-rolled code.

Alternatives considered:
- **Roll our own** with `d3-force` + canvas + `d3-zoom`: maximum control, more code and edge cases (hit-testing, label collision). Reasonable fallback if we want zero new heavy deps.
- **Cosmograph / Cosmos (WebGL)**: GPU layout that can render 100k+ nodes if we ever want a true statewide graph. Heavier and more complex; revisit only if scoped subgraphs prove too limiting.

Decision: start with `react-force-graph-2d`. Keep the graph-building logic decoupled from the renderer so swapping is cheap.

## 6. Backend work (Supabase)

Add a migration with precomputed aggregates so node weights and the hub ranking are cheap (computing well counts per operator on the fly across the whole set is too slow for ranking).

1. **`mv_operator_well_counts`** (materialized view): `operator_number -> wells` from `well_operator`. Refreshed alongside the existing ingest. Gives O(1) operator node weight.

2. **`mv_person_affiliations`** (materialized view): from `operator_officers` joined to `mv_operator_well_counts`, grouped by `officer_name`:
   - `officer_name`, `operator_count` (degree), `total_wells` (sum of connected operators' well counts), `is_filing_agent` (any title matching filing/agent), `titles` (distinct set).
   - This single view answers "which filing agents handle the most volume in Texas?" with `where is_filing_agent order by total_wells desc`.

3. **RPC `network_top_hubs(p_role, p_min_operators, p_limit)`**: returns the top people by `total_wells` or `operator_count`, optionally filtered to filing agents / resident agents. Feeds the default "Top hubs" scope and a ranked side list.

4. **RPC `network_subgraph(...)`**: given a seed (operator number, officer name, or county) and a hop limit + node cap, return a normalized `{ nodes, edges }` payload (operators with well counts + status, people with degree, affiliation edges with title/status). One round trip per scope/expand instead of the multi-query client assembly `getPrincipalDetail` does today.

Identity note: v1 keys people by `officer_name`. A later migration can upgrade `mv_person_affiliations` to group by `operator_contacts.person_key` where available, collapsing name variants of the same human.

## 7. Frontend work

### 7.1 New files (keep them small, per the many-small-files rule)

```
src/lib/wells/network.ts          // types + client queries: getTopHubs, getNetworkSubgraph
src/components/map/network-graph.tsx     // the react-force-graph-2d canvas + simulation config
src/components/map/network-controls.tsx  // scope/role/status/min-wells controls for the left panel
src/components/map/network-legend.tsx    // node-size + color legend (light theme)
src/lib/wells/graph-style.ts      // sqrt size scale, color-by-mode, label rules (pure, testable)
```

### 7.2 Wiring into the existing page

- **Toggle:** extend `MapMode` in [map-filters.tsx](../src/components/map/map-filters.tsx#L17) to `"wells" | "operators" | "network"` and add `{ label: "Network", v: "network" }` to the `Seg` at [map-filters.tsx:128](../src/components/map/map-filters.tsx#L128). Add network-specific fields (scope selector, role filter, status filter, min wells) shown when `mode === "network"`, reusing the existing operator-search and county-search inputs already in this component.
- **Canvas swap:** in [wells-map.tsx](../src/components/map/wells-map.tsx), when `filters.mode === "network"`, render `<NetworkGraph>` as an overlay covering the Mapbox container (Mapbox stays mounted underneath, hidden). This avoids a large refactor of the map state machine. The cleaner long-term option (lifting a `MapWorkspace` wrapper that conditionally renders `WellsMap` vs `NetworkGraph`) is noted as optional follow-up.
- **Detail panel reuse (high-value):** `NetworkGraph` calls the *same* `setSelectedOperator` / `setSelectedPrincipal` handlers `WellsMap` already owns. Clicking an operator node opens the existing `OperatorDetailPanel`; clicking a person node opens the existing `PrincipalDetailPanel`. No new detail UI needed, and the panels' existing "select operator / select principal" cross-links let the user walk the graph through the panels too.
- **AI context:** push the current scope + visible top hubs into the existing map AI context store so Archon can answer "who's the biggest filing partner on screen."

### 7.3 Interaction

- Hover: highlight node + its edges, show a tooltip (name, well count or degree, role).
- Click: open the matching detail panel; optionally expand neighbors.
- Double-click / "expand" button on a node: fetch and merge that node's neighbors (capped).
- Zoom/pan via the library; "fit to view" button; recenter on seed.
- Recolor control: type / status / role.

## 8. Phased delivery

**Phase 1: Backend aggregates.** Migration for `mv_operator_well_counts`, `mv_person_affiliations`, and `network_top_hubs`. Verify cardinalities (step 0 count query). Confirm the filing-agent volume ranking returns sane results.

**Phase 2: Renderer skeleton.** Add `react-force-graph-2d`. Build `network-graph.tsx` with hardcoded sample data, light-theme paint, sqrt sizing, zoom/pan, hover/click logging. Validate performance at 300 / 800 / 2000 nodes.

**Phase 3: Top-hubs scope wired end to end.** `getTopHubs` + `network_top_hubs`, default Network view shows top connectors and their operators. Hook node clicks to the existing detail panels.

**Phase 4: Seed + expand.** `network_subgraph` RPC + `getNetworkSubgraph`. Seed by operator / person / county from the controls; on-demand neighbor expansion with caps.

**Phase 5: Controls, legend, polish.** `network-controls.tsx`, `network-legend.tsx`, recolor modes, fit-to-view, hub labels, empty/loading/capped states. Push scope to AI context.

**Phase 6 (optional/future).** `person_key`-based identity; WebGL renderer for statewide; saved/exported prospect lists from a selection.

## 9. Risks and open questions

- **Identity collisions/splits:** exact-name keying merges two different "SMITH, JOHN" and splits "PALMOUR, VICKI" vs "PALMOUR, VICKI A." Acceptable for v1 (matches current app behavior); `person_key` upgrade later.
- **Hub explosion:** a 199-operator person can dominate a subgraph. Mitigate with caps, top-by-well-count ordering, and collapse/expand.
- **Layout churn:** force simulations jitter on data change. Pin the seed node and freeze simulation after settle.
- **Materialized view freshness:** must refresh in the ingest pipeline; document it next to the existing refresh steps.
- **Title normalization:** "FILING AGENT", "RESIDENT TEXAS AGENT", and free-text variants need a normalization map to drive the role filter reliably.

## 10. Out of scope (v1)

- Person-to-person direct edges (kept bipartite).
- Geographic placement of nodes (this view is relational, not spatial; that is what Wells/Operators views are for).
- Full statewide single-graph rendering.
- Writing prospect data back / CRM export (candidate for a later phase).
