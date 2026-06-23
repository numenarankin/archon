/**
 * Client-side bridge between the semantic graph and the live tldraw editor.
 * Runs only in the browser (imported by the canvas, which is loaded ssr:false).
 *
 *  - materializeSpec: lay a spec out with dagre and create real tldraw shapes.
 *  - graphFromEditor: read the current canvas back into a semantic graph
 *    (the inverse), used on every autosave so Archon stays in sync with edits.
 */
import dagre from "@dagrejs/dagre";
import {
  renderPlaintextFromRichText,
  getArrowBindings,
  getArrowInfo,
  type Editor,
  type TLArrowShape,
  type TLRichText,
} from "tldraw";
import type {
  DiagramGraph,
  DiagramNode,
  DiagramSpec,
  NodeShape,
} from "@/lib/diagrams/types";

const NODE_W = 180;
const NODE_H = 72;
const TEXT_W = 140;
const TEXT_H = 36;

/** tldraw geo kind ↔ our node shape. */
const SHAPE_TO_GEO: Record<Exclude<NodeShape, "text">, string> = {
  box: "rectangle",
  diamond: "diamond",
  ellipse: "ellipse",
};
const GEO_TO_SHAPE: Record<string, NodeShape> = {
  rectangle: "box",
  diamond: "diamond",
  ellipse: "ellipse",
  oval: "ellipse",
};

/** Minimal TipTap-doc richText for a single line of text (avoids toRichText). */
function richText(text: string): TLRichText {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: text ? [{ type: "text", text }] : [],
      },
    ],
  } as unknown as TLRichText;
}

function sizeFor(shape: NodeShape): { w: number; h: number } {
  return shape === "text"
    ? { w: TEXT_W, h: TEXT_H }
    : { w: NODE_W, h: NODE_H };
}

/**
 * Lay out a spec with dagre (top-to-bottom) and create the shapes on the
 * editor's current page. Edges connect the bottom-centre of the source to the
 * top-centre of the target — clean for flowcharts without needing bindings.
 */
export function materializeSpec(editor: Editor, spec: DiagramSpec): void {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 90, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  const sizes = new Map<string, { w: number; h: number }>();
  for (const n of spec.nodes) {
    const size = sizeFor(n.shape ?? "box");
    sizes.set(n.id, size);
    g.setNode(n.id, { width: size.w, height: size.h });
  }
  for (const e of spec.edges) {
    if (sizes.has(e.from) && sizes.has(e.to)) g.setEdge(e.from, e.to);
  }
  dagre.layout(g);

  // Remember each node's top-left + size so we can anchor arrows.
  const placed = new Map<string, { x: number; y: number; w: number; h: number }>();

  editor.run(() => {
    for (const n of spec.nodes) {
      const pos = g.node(n.id);
      const size = sizes.get(n.id)!;
      if (!pos) continue;
      const x = pos.x - size.w / 2;
      const y = pos.y - size.h / 2;
      placed.set(n.id, { x, y, w: size.w, h: size.h });
      const shape = n.shape ?? "box";

      if (shape === "text") {
        editor.createShape({
          type: "text",
          x,
          y,
          props: { richText: richText(n.label) },
        });
      } else {
        editor.createShape({
          type: "geo",
          x,
          y,
          props: {
            geo: SHAPE_TO_GEO[shape],
            w: size.w,
            h: size.h,
            richText: richText(n.label),
          },
        });
      }
    }

    for (const e of spec.edges) {
      const a = placed.get(e.from);
      const b = placed.get(e.to);
      if (!a || !b) continue;
      const start = { x: a.x + a.w / 2, y: a.y + a.h };
      const end = { x: b.x + b.w / 2, y: b.y };
      editor.createShape({
        type: "arrow",
        x: 0,
        y: 0,
        props: {
          start,
          end,
          // Arrow labels are a plain string prop (not richText like geo/text).
          text: e.label ?? "",
          arrowheadStart: "none",
          arrowheadEnd: e.dir === "->" ? "arrow" : "none",
        },
      });
    }
  });
}

// ── Reading the canvas back into a graph ────────────────────────────────────

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

function plainText(editor: Editor, value: unknown): string {
  if (!value) return "";
  try {
    return renderPlaintextFromRichText(editor, value as TLRichText).trim();
  } catch {
    return "";
  }
}

type Pt = { x: number; y: number };

function nearest(pt: Pt, nodes: Map<string, Bounds>): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const [id, b] of nodes) {
    const d = distToBounds2(pt, b);
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}

function dist2(a: Pt, b: Pt): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

/** Squared distance from a point to a box (0 when the point is inside it). */
function distToBounds2(pt: Pt, b: Bounds): number {
  const dx = Math.max(b.x - pt.x, 0, pt.x - (b.x + b.w));
  const dy = Math.max(b.y - pt.y, 0, pt.y - (b.y + b.h));
  return dx * dx + dy * dy;
}

interface NodeAcc {
  id: string;
  label: string;
  shape: NodeShape;
  b: Bounds;
  notes: string[];
}

interface ArrowAcc {
  from: string;
  to: string;
  dir: "->" | "--";
  mid: Pt;
  labels: string[];
}

/** Loose text counts as an edge label only if it's short + single-line. */
function looksLikeLabel(text: string): boolean {
  return text.length <= 30 && !text.includes("\n");
}

/**
 * Project the current canvas into a semantic graph:
 *  - geo shapes (boxes) are the nodes;
 *  - arrows are edges, with from/to + direction taken from tldraw's bindings;
 *  - loose text shapes are associated by POSITION — a short label sitting on an
 *    arrow becomes that edge's label, and a description sitting next to a box
 *    becomes that node's note. This is what lets Archon read each line's label
 *    and each box's description the way a person would by looking at the canvas.
 */
export function graphFromEditor(editor: Editor, title: string): DiagramGraph {
  const shapes = editor.getCurrentPageShapes();

  const nodeAccs: NodeAcc[] = [];
  const bounds = new Map<string, Bounds>();
  const textShapes: { center: Pt; text: string }[] = [];

  for (const s of shapes) {
    if (s.type === "geo") {
      const props = (s as { props: Record<string, unknown> }).props;
      const pb = editor.getShapePageBounds(s);
      if (!pb) continue;
      const b: Bounds = {
        x: pb.x,
        y: pb.y,
        w: pb.w,
        h: pb.h,
        cx: pb.center.x,
        cy: pb.center.y,
      };
      bounds.set(s.id, b);
      nodeAccs.push({
        id: s.id,
        label: plainText(editor, props.richText),
        shape: GEO_TO_SHAPE[String(props.geo)] ?? "box",
        b,
        notes: [],
      });
    } else if (s.type === "text") {
      const props = (s as { props: Record<string, unknown> }).props;
      const text = plainText(editor, props.richText);
      const pb = editor.getShapePageBounds(s);
      if (text && pb) {
        textShapes.push({ center: { x: pb.center.x, y: pb.center.y }, text });
      }
    }
  }

  // Arrows → edges, with direction from bindings and a page-space midpoint.
  const arrowAccs: ArrowAcc[] = [];
  for (const s of shapes) {
    if (s.type !== "arrow") continue;
    const arrow = s as TLArrowShape;
    const props = arrow.props;

    let fromId: string | null = null;
    let toId: string | null = null;

    // Authoritative: tldraw's own arrow bindings. `start` is the tail, `end`
    // is the head — the arrow points from start-bound to end-bound shape.
    const arrowBindings = getArrowBindings(editor, arrow);
    if (arrowBindings.start) fromId = arrowBindings.start.toId;
    if (arrowBindings.end) toId = arrowBindings.end.toId;

    // Resolved endpoints (also covers unbound terminals + the midpoint).
    const info = getArrowInfo(editor, arrow);
    const transform = editor.getShapePageTransform(arrow);
    let mid: Pt = { x: bounds.get(fromId ?? "")?.cx ?? 0, y: 0 };
    if (info && transform) {
      const sp = transform.applyToPoint(info.start.point);
      const ep = transform.applyToPoint(info.end.point);
      mid = { x: (sp.x + ep.x) / 2, y: (sp.y + ep.y) / 2 };
      if (!fromId) fromId = nearest(sp, bounds);
      if (!toId) toId = nearest(ep, bounds);
    }

    if (!fromId || !toId || fromId === toId) continue;
    if (!bounds.has(fromId) || !bounds.has(toId)) continue;
    const dir = props.arrowheadEnd && props.arrowheadEnd !== "none" ? "->" : "--";
    // An arrow's own inline label (props.text) seeds the labels list.
    const inline = (props.text ?? "").trim();
    arrowAccs.push({
      from: fromId,
      to: toId,
      dir,
      mid,
      labels: inline ? [inline] : [],
    });
  }

  // Associate each loose text shape with the arrow or node it sits next to.
  for (const t of textShapes) {
    let bestArrow: ArrowAcc | null = null;
    let bestArrowD = Infinity;
    for (const a of arrowAccs) {
      const d = dist2(t.center, a.mid);
      if (d < bestArrowD) {
        bestArrowD = d;
        bestArrow = a;
      }
    }
    let bestNode: NodeAcc | null = null;
    let bestNodeD = Infinity;
    for (const n of nodeAccs) {
      const d = distToBounds2(t.center, n.b);
      if (d < bestNodeD) {
        bestNodeD = d;
        bestNode = n;
      }
    }

    // Short text hugging an arrow → that edge's label. Everything else (long
    // descriptions, or text clearly closest to a box) → that node's note.
    if (looksLikeLabel(t.text) && bestArrow && bestArrowD <= bestNodeD) {
      bestArrow.labels.push(t.text);
    } else if (bestNode) {
      bestNode.notes.push(t.text);
    } else if (bestArrow) {
      bestArrow.labels.push(t.text);
    }
  }

  const nodes: DiagramNode[] = nodeAccs.map((n) => ({
    id: n.id,
    label: n.label,
    shape: n.shape,
    note: n.notes.length ? n.notes.join(" ") : undefined,
  }));
  const edges = arrowAccs.map((a) => ({
    from: a.from,
    to: a.to,
    dir: a.dir,
    label: a.labels.length ? a.labels.join(", ") : undefined,
  }));

  return { title, nodes, edges, groups: [] };
}
