"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { XIcon, NetworkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ForceSimulation, colorForTag } from "@/lib/kb/force-layout";
import {
  loadGraph,
  loadFileTags,
  addTag,
  removeTag,
} from "@/lib/files/graph-actions";
import type { GraphData, GraphNode, Tag } from "@/lib/kb/types";

interface KnowledgeGraphViewProps {
  /** Scope to a project folder; omit for the whole corpus. */
  folderId?: string;
}

const NODE_RADIUS = 7;

/**
 * The "Knowledge Graph" tab: a force-directed view of documents (nodes) linked
 * by bridges (edges), colored by topic tag. Drag nodes to rearrange, click one
 * to inspect and edit its tags, and filter by tag from the rail.
 */
export function KnowledgeGraphView({ folderId }: KnowledgeGraphViewProps) {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Positions live in state (snapshotted each tick) so render never reads a ref.
  const [positions, setPositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<ForceSimulation | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);

  // Load the graph.
  useEffect(() => {
    let active = true;
    loadGraph(folderId)
      .then((g) => active && setGraph(g))
      .catch((error) => console.error("loadGraph failed", error));
    return () => {
      active = false;
    };
  }, [folderId]);

  // Track container size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.max(width, 100), h: Math.max(height, 100) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const runLoop = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    const step = () => {
      const sim = simRef.current;
      if (!sim) {
        runningRef.current = false;
        return;
      }
      const alpha = sim.tick();
      setPositions(new Map(sim.nodes.map((n) => [n.id, { x: n.x, y: n.y }])));
      if (alpha > 0.005 || dragRef.current) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        runningRef.current = false;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  // (Re)build the simulation when graph or size changes.
  useEffect(() => {
    if (!graph || size.w === 0) return;
    const sim = new ForceSimulation(
      graph.nodes.map((n) => n.id),
      graph.edges.map((e) => ({ source: e.source, target: e.target })),
      size.w,
      size.h
    );
    simRef.current = sim;
    // runLoop snapshots positions into state on its first frame.
    runLoop();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      runningRef.current = false;
    };
  }, [graph, size.w, size.h, runLoop]);

  const nodeById = useMemo(
    () => new Map((graph?.nodes ?? []).map((n) => [n.id, n])),
    [graph]
  );

  const allTags = useMemo(() => {
    const map = new Map<string, Tag>();
    for (const n of graph?.nodes ?? []) {
      for (const t of n.tags) map.set(t.slug, t);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [graph]);

  function svgPoint(e: React.PointerEvent): { x: number; y: number } {
    const rect = svgRef.current?.getBoundingClientRect();
    return {
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    };
  }

  function onNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { id, moved: false };
    simRef.current?.setFixed(id, svgPoint(e));
    simRef.current?.reheat();
    runLoop();
  }

  function onNodePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    drag.moved = true;
    simRef.current?.setFixed(drag.id, svgPoint(e));
  }

  function onNodePointerUp(e: React.PointerEvent, id: string) {
    const drag = dragRef.current;
    dragRef.current = null;
    simRef.current?.setFixed(id, null);
    if (drag && !drag.moved) setSelectedId((cur) => (cur === id ? null : id));
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }

  const isDimmed = useCallback(
    (node: GraphNode) =>
      activeTag != null && !node.tags.some((t) => t.slug === activeTag),
    [activeTag]
  );

  async function refreshGraph() {
    const g = await loadGraph(folderId);
    setGraph(g);
  }

  const selected = selectedId ? nodeById.get(selectedId) : null;

  if (graph && graph.nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
        <NetworkIcon className="mb-3 size-10 opacity-40" />
        <p className="text-sm">No documents to graph yet.</p>
        <p className="max-w-sm text-xs">
          Cite documents with @ or footnotes, or add tags, and the connections
          will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-3">
      {/* Tag filter rail */}
      <div className="w-44 shrink-0 overflow-y-auto rounded-lg border border-border p-2">
        <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
          Topics
        </p>
        <button
          type="button"
          onClick={() => setActiveTag(null)}
          className={cn(
            "mb-0.5 w-full rounded px-2 py-1 text-left text-sm",
            activeTag === null ? "bg-accent" : "hover:bg-accent/50"
          )}
        >
          All documents
        </button>
        {allTags.map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => setActiveTag((cur) => (cur === t.slug ? null : t.slug))}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm",
              activeTag === t.slug ? "bg-accent" : "hover:bg-accent/50"
            )}
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: colorForTag(t.slug) }}
            />
            <span className="truncate">{t.name}</span>
          </button>
        ))}
        {allTags.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">No tags yet</p>
        )}
      </div>

      {/* Graph canvas */}
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background-subtle"
        onPointerDown={() => setSelectedId(null)}
      >
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          className="block touch-none"
        >
          {graph?.edges.map((edge) => {
            const a = positions.get(edge.source);
            const b = positions.get(edge.target);
            if (!a || !b) return null;
            const dim =
              activeTag != null &&
              isDimmed(nodeById.get(edge.source)!) &&
              isDimmed(nodeById.get(edge.target)!);
            return (
              <line
                key={edge.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={edge.createdBy === "ai" ? "#fbbf24" : "var(--border)"}
                strokeWidth={1.5}
                strokeDasharray={edge.kind === "footnote" ? "4 3" : undefined}
                opacity={dim ? 0.1 : 0.7}
              />
            );
          })}
          {graph?.nodes.map((node) => {
            const p = positions.get(node.id);
            if (!p) return null;
            const dim = isDimmed(node);
            const color = node.tags[0]
              ? colorForTag(node.tags[0].slug)
              : "var(--muted-foreground)";
            const isSel = node.id === selectedId;
            return (
              <g
                key={node.id}
                opacity={dim ? 0.2 : 1}
                className="cursor-pointer"
                onPointerDown={(e) => onNodePointerDown(e, node.id)}
                onPointerMove={onNodePointerMove}
                onPointerUp={(e) => onNodePointerUp(e, node.id)}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSel ? NODE_RADIUS + 2 : NODE_RADIUS}
                  fill={color}
                  stroke={isSel ? "var(--foreground)" : "transparent"}
                  strokeWidth={2}
                />
                <text
                  x={p.x + NODE_RADIUS + 3}
                  y={p.y + 3}
                  className="fill-foreground text-[10px]"
                  style={{ pointerEvents: "none" }}
                >
                  {node.name.length > 24
                    ? `${node.name.slice(0, 23)}…`
                    : node.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Details panel */}
      {selected && (
        <NodeDetails
          key={selected.id}
          node={selected}
          edges={graph?.edges ?? []}
          nodeById={nodeById}
          folderId={folderId}
          onClose={() => setSelectedId(null)}
          onChanged={refreshGraph}
        />
      )}
    </div>
  );
}

interface NodeDetailsProps {
  node: GraphNode;
  edges: GraphData["edges"];
  nodeById: Map<string, GraphNode>;
  folderId?: string;
  onClose: () => void;
  onChanged: () => void;
}

function NodeDetails({
  node,
  edges,
  nodeById,
  onClose,
  onChanged,
}: NodeDetailsProps) {
  // Remounted per node (keyed by id), so props seed initial state directly.
  const [tags, setTags] = useState<Tag[]>(node.tags);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Pull authoritative tags (the graph node only carries in-scope tags).
    loadFileTags(node.id)
      .then(setTags)
      .catch((error) => console.error("loadFileTags failed", error));
  }, [node.id]);

  const cites = edges
    .filter((e) => e.source === node.id)
    .map((e) => ({ edge: e, other: nodeById.get(e.target) }));
  const citedBy = edges
    .filter((e) => e.target === node.id)
    .map((e) => ({ edge: e, other: nodeById.get(e.source) }));

  async function handleAdd() {
    const name = draft.trim();
    if (!name) return;
    setBusy(true);
    try {
      const tag = await addTag(node.id, name, "user");
      if (tag && !tags.some((t) => t.id === tag.id)) setTags([...tags, tag]);
      setDraft("");
      onChanged();
    } catch (error) {
      console.error("addTag failed", error);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(tagId: string) {
    setTags(tags.filter((t) => t.id !== tagId));
    try {
      await removeTag(node.id, tagId);
      onChanged();
    } catch (error) {
      console.error("removeTag failed", error);
    }
  }

  return (
    <div className="flex w-64 shrink-0 flex-col gap-3 overflow-y-auto rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{node.name}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-0.5 text-muted-foreground hover:bg-accent"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Tags</p>
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t.id}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
              style={{
                background: `color-mix(in oklab, ${colorForTag(t.slug)} 22%, transparent)`,
              }}
            >
              {t.name}
              <button
                type="button"
                onClick={() => handleRemove(t.id)}
                aria-label={`Remove ${t.name}`}
                className="hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
          {tags.length === 0 && (
            <span className="text-xs text-muted-foreground">None</span>
          )}
        </div>
        <div className="mt-2 flex gap-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add tag…"
            disabled={busy}
            className="min-w-0 flex-1 rounded border border-border bg-transparent px-2 py-1 text-xs outline-none"
          />
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Cites ({cites.length})
        </p>
        {cites.length === 0 ? (
          <p className="text-xs text-muted-foreground">None</p>
        ) : (
          <ul className="space-y-0.5">
            {cites.map(({ edge, other }) => (
              <li key={edge.id} className="truncate text-xs">
                → {other?.name ?? "unknown"}
                {edge.kind === "footnote" && " (footnote)"}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Cited by ({citedBy.length})
        </p>
        {citedBy.length === 0 ? (
          <p className="text-xs text-muted-foreground">None</p>
        ) : (
          <ul className="space-y-0.5">
            {citedBy.map(({ edge, other }) => (
              <li key={edge.id} className="truncate text-xs">
                ← {other?.name ?? "unknown"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
