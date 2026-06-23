/**
 * Diagram types — the semantic shape-graph that both the canvas and Archon
 * speak. The tldraw snapshot (in `files.content`) is the visual source of
 * truth; this graph is the machine-legible projection of it that gets cached
 * on `files.structured_summary`, rendered to text for embeddings, and produced
 * by Archon when it draws a diagram. Nodes and edges only — positions are
 * always derived (by dagre on the client), never authored here.
 */
import { z } from "zod";

/** The visual kind of a node. Maps to a tldraw geo/text shape. */
export type NodeShape = "box" | "diamond" | "ellipse" | "text";

export interface DiagramNode {
  id: string;
  label: string;
  shape: NodeShape;
  /** Free text positioned next to the node on the canvas (a description). */
  note?: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  /** "->" directed (arrowhead), "--" undirected (plain line). */
  dir: "->" | "--";
}

export interface DiagramGroup {
  label: string;
  nodeIds: string[];
}

export interface DiagramGraph {
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups: DiagramGroup[];
}

// ── Zod schemas for the Archon tools ────────────────────────────────────────
// `create_diagram` / `edit_diagram` take these. The model supplies structure
// only; layout is computed deterministically.

const nodeSchema = z.object({
  id: z.string().describe("a short stable id, e.g. 'n1' or 'title-search'"),
  label: z.string().describe("the text shown in the node"),
  shape: z
    .enum(["box", "diamond", "ellipse", "text"])
    .default("box")
    .describe("box for steps, diamond for decisions, ellipse for start/end"),
});

const edgeSchema = z.object({
  from: z.string().describe("source node id"),
  to: z.string().describe("target node id"),
  label: z.string().optional().describe("optional edge label, e.g. 'yes'/'no'"),
  dir: z.enum(["->", "--"]).default("->"),
});

export const DiagramSpecSchema = z.object({
  title: z.string().describe("a short title for the diagram"),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  groups: z
    .array(
      z.object({
        label: z.string(),
        nodeIds: z.array(z.string()),
      })
    )
    .default([]),
});

export type DiagramSpec = z.infer<typeof DiagramSpecSchema>;

export const DiagramOpsSchema = z.object({
  setTitle: z.string().optional(),
  addNodes: z.array(nodeSchema).optional(),
  removeNodeIds: z.array(z.string()).optional(),
  addEdges: z.array(edgeSchema).optional(),
  removeEdges: z
    .array(z.object({ from: z.string(), to: z.string() }))
    .optional(),
});

export type DiagramOps = z.infer<typeof DiagramOpsSchema>;

/** Normalize a spec into a full graph (fills defaults, drops dangling edges). */
export function specToGraph(spec: DiagramSpec): DiagramGraph {
  const ids = new Set(spec.nodes.map((n) => n.id));
  return {
    title: spec.title,
    nodes: spec.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      shape: n.shape ?? "box",
    })),
    edges: spec.edges
      .filter((e) => ids.has(e.from) && ids.has(e.to))
      .map((e) => ({ from: e.from, to: e.to, label: e.label, dir: e.dir ?? "->" })),
    groups: (spec.groups ?? []).map((g) => ({
      label: g.label,
      nodeIds: g.nodeIds.filter((id) => ids.has(id)),
    })),
  };
}

/**
 * What `files.content` holds for a diagram that Archon created but no one has
 * opened yet: the spec, waiting to be laid out into real tldraw shapes the
 * first time the canvas mounts. Once materialized, `content` is a tldraw
 * snapshot instead.
 */
export interface PendingDiagram {
  pending: DiagramSpec;
}

export function isPendingDiagram(value: unknown): value is PendingDiagram {
  return (
    typeof value === "object" &&
    value !== null &&
    "pending" in value &&
    typeof (value as { pending: unknown }).pending === "object"
  );
}
