/**
 * Render a diagram's semantic graph to compact text. This is the single most
 * important bridge to Archon: it converts spatial structure (boxes, arrows,
 * groups) into explicit relationships a text model reads intuitively. The
 * output is stored on `files.derived_content` and embedded for search, and is
 * what `read_diagram` returns. Pure + dependency-free so it runs anywhere.
 */
import type { DiagramGraph } from "@/lib/diagrams/types";

export function graphToText(graph: DiagramGraph): string {
  const { title, nodes, edges, groups } = graph;
  const labelById = new Map(nodes.map((n) => [n.id, n.label]));
  const lines: string[] = [];

  lines.push(
    `Diagram "${title}" — ${nodes.length} ${
      nodes.length === 1 ? "node" : "nodes"
    }, ${edges.length} ${edges.length === 1 ? "connection" : "connections"}.`
  );

  if (nodes.length > 0) {
    lines.push("Nodes:");
    for (const n of nodes) {
      const kind = n.shape !== "box" ? ` (${n.shape})` : "";
      const note = n.note ? ` — ${n.note}` : "";
      lines.push(`  - ${n.label}${kind}${note}`);
    }
  }

  if (edges.length > 0) {
    lines.push("Connections:");
    for (const e of edges) {
      const a = labelById.get(e.from) ?? e.from;
      const b = labelById.get(e.to) ?? e.to;
      const arrow = e.dir === "->" ? "-->" : "---";
      const mid = e.label ? ` --${e.label}${arrow} ` : ` ${arrow} `;
      lines.push(`  ${a}${mid}${b}`);
    }
  }

  if (groups.length > 0) {
    for (const g of groups) {
      const names = g.nodeIds.map((id) => labelById.get(id) ?? id);
      lines.push(`Group "${g.label}" contains { ${names.join(", ")} }`);
    }
  }

  return lines.join("\n");
}
