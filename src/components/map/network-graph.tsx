"use client";

// Force-directed knowledge graph on a Canvas. d3-force runs the physics; we paint
// and handle pan/zoom/hover/click by hand (no d3-zoom/selection types needed).
// Single click selects a node (opens the existing detail panels); double click
// reseeds the graph on that node; drag repositions a node; wheel/drag-background
// pan and zoom.
import { useEffect, useRef, useState } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
} from "d3-force";
import {
  colorFor,
  labelVisible,
  radiusFor,
  LINK_COLOR,
  type ColorMode,
  type GraphData,
  type GraphLink,
  type GraphNode,
} from "@/lib/wells/graph-style";

interface Transform {
  k: number;
  x: number;
  y: number;
}

interface Tooltip {
  node: GraphNode;
  sx: number;
  sy: number;
}

export interface NetworkGraphProps {
  data: GraphData;
  colorMode: ColorMode;
  onSelectNode: (node: GraphNode) => void;
  onReseedNode: (node: GraphNode) => void;
}

const CLICK_MOVE_TOL = 4; // px of movement still counts as a click, not a drag

export function NetworkGraph({
  data,
  colorMode,
  onSelectNode,
  onReseedNode,
}: NetworkGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const transformRef = useRef<Transform>({ k: 1, x: 0, y: 0 });
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 1, h: 1, dpr: 1 });
  const hoverRef = useRef<GraphNode | null>(null);
  const colorModeRef = useRef<ColorMode>(colorMode);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [viewWidth, setViewWidth] = useState(0);

  const toScreen = (n: GraphNode) => {
    const t = transformRef.current;
    return { x: (n.x ?? 0) * t.k + t.x, y: (n.y ?? 0) * t.k + t.y };
  };

  // Screen radius. We do NOT shrink linearly with zoom (that turned every node
  // into an invisible dot when fit-to-view zoomed out): clamp the zoom factor so
  // nodes stay legible, with a hard floor so the smallest still register.
  const renderRadius = (n: GraphNode) => {
    const k = Math.max(0.55, Math.min(transformRef.current.k, 1.8));
    return Math.max(1.6, radiusFor(n) * k);
  };

  // Simple AABB overlap test for greedy label decluttering.
  const overlaps = (
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
  ) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // The single source of truth for painting; called on every simulation tick and
  // after any pan/zoom.
  const draw = () => {
    const canvas = canvasRef.current;
    const sim = simRef.current;
    if (!canvas || !sim) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    const t = transformRef.current;
    const mode = colorModeRef.current;
    const nodes = sim.nodes();
    const links = (sim.force("link") as ReturnType<typeof forceLink> | null)?.links() as
      | GraphLink[]
      | undefined;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Links.
    ctx.lineWidth = Math.min(1.2, 0.6 * t.k);
    ctx.strokeStyle = LINK_COLOR;
    ctx.globalAlpha = 0.5;
    if (links) {
      ctx.beginPath();
      for (const l of links) {
        const s = l.source as GraphNode;
        const d = l.target as GraphNode;
        const a = toScreen(s);
        const b = toScreen(d);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Nodes.
    const hover = hoverRef.current;
    for (const n of nodes) {
      const p = toScreen(n);
      const r = renderRadius(n);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = colorFor(n, mode);
      ctx.globalAlpha = 0.92;
      ctx.fill();
      if (n === hover) {
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#0f172a";
        ctx.stroke();
      } else if (n.type === "person" && n.weight >= 8) {
        // Subtle ring marks the connector hubs.
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Labels: greedy declutter. Most-important nodes (hover, then biggest) claim
    // their space first; any later label that would overlap one already drawn is
    // skipped, so the canvas stays readable instead of a wall of stacked text.
    ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const candidates = nodes
      .filter((n) => n === hover || labelVisible(n, t.k))
      .sort((a, b) => {
        if (a === hover) return -1;
        if (b === hover) return 1;
        // People (the hubs you are hunting) win ties over operators.
        const at = a.type === "person" ? 1 : 0;
        const bt = b.type === "person" ? 1 : 0;
        return bt - at || b.weight - a.weight;
      });
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const n of candidates) {
      const p = toScreen(n);
      const r = renderRadius(n);
      const text = n.label.length > 30 ? `${n.label.slice(0, 29)}…` : n.label;
      const tw = ctx.measureText(text).width;
      const box = { x: p.x + r + 3, y: p.y - 7, w: tw + 2, h: 14 };
      if (n !== hover && placed.some((q) => overlaps(q, box))) continue;
      placed.push(box);
      // White halo so labels read over the edge mesh.
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.strokeText(text, box.x, p.y);
      ctx.fillStyle = n.type === "person" ? "#5b21b6" : "#0f172a";
      ctx.fillText(text, box.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  };

  // Fit the current node cloud into view (used after a fresh layout settles).
  const fitView = () => {
    const sim = simRef.current;
    if (!sim) return;
    const nodes = sim.nodes();
    if (!nodes.length) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x ?? 0);
      minY = Math.min(minY, n.y ?? 0);
      maxX = Math.max(maxX, n.x ?? 0);
      maxY = Math.max(maxY, n.y ?? 0);
    }
    const { w, h } = sizeRef.current;
    const gw = Math.max(1, maxX - minX);
    const gh = Math.max(1, maxY - minY);
    // Clamp so a big spread-out graph does not zoom out into a speck. If it
    // overflows the viewport at the floor, the user pans (hubs stay readable).
    const k = Math.min(1.4, Math.max(0.32, 0.85 * Math.min(w / gw, h / gh)));
    transformRef.current = {
      k,
      x: w / 2 - ((minX + maxX) / 2) * k,
      y: h / 2 - ((minY + maxY) / 2) * k,
    };
    draw();
  };

  // Build / rebuild the simulation whenever the data changes. Node objects carry
  // their own x/y, so d3-force mutates them in place.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Seed initial positions on a circle to reduce the opening "explosion".
    const n = data.nodes.length;
    data.nodes.forEach((node, i) => {
      if (node.x == null || node.y == null) {
        const a = (i / Math.max(1, n)) * Math.PI * 2;
        const rad = 30 + Math.sqrt(n) * 8;
        node.x = Math.cos(a) * rad;
        node.y = Math.sin(a) * rad;
      }
    });

    const sim = forceSimulation<GraphNode, GraphLink>(data.nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(data.links)
          .id((d) => d.id)
          // Leaves sit at a fixed radius off their hub; scale the spoke length by
          // both endpoints' sizes so big hubs get a roomy halo, not a tight clump.
          .distance((l) => {
            const s = l.source as GraphNode;
            const t = l.target as GraphNode;
            return 34 + radiusFor(s) + radiusFor(t) + (l.hop ? 60 : 0);
          })
          .strength(0.5),
      )
      // Strong repulsion (scaled up for hubs) is what actually fans the spokes
      // out instead of stacking them. Barnes-Hut keeps it cheap at ~900 nodes.
      .force(
        "charge",
        forceManyBody<GraphNode>()
          .strength((d) => -55 - radiusFor(d) * 9)
          .distanceMax(600)
          .theta(0.85),
      )
      .force(
        "collide",
        forceCollide<GraphNode>()
          .radius((d) => radiusFor(d) + 6)
          .strength(0.9),
      )
      // Gentle pull to origin keeps disconnected clusters from drifting away
      // without crushing the layout together like forceCenter does.
      .force("x", forceX<GraphNode>(0).strength(0.012))
      .force("y", forceY<GraphNode>(0).strength(0.012))
      .alpha(1)
      .alphaDecay(0.022)
      .velocityDecay(0.4);

    simRef.current = sim;
    // Auto-fit ONCE, when this layout first settles. After that the viewport
    // belongs to the user: clicking or dragging a node reheats the sim, and we
    // must NOT re-fit when it cools again (that yanked the user's zoom/pan back
    // to fit-all and read as a random "reset").
    let fitted = false;
    const fitOnce = () => {
      if (fitted) return;
      fitted = true;
      fitView();
    };
    sim.on("tick", () => {
      draw();
      if (sim.alpha() < 0.5) fitOnce();
    });
    sim.on("end", fitOnce);

    return () => {
      sim.stop();
      simRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Size the canvas to its container (and on resize).
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const apply = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      sizeRef.current = { w, h, dpr };
      setViewWidth(w);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      draw();
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repaint when the color mode changes without rebuilding the layout.
  useEffect(() => {
    colorModeRef.current = colorMode;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorMode]);

  // Hit test in screen space (nodes are few enough to scan linearly).
  const nodeAt = (sx: number, sy: number): GraphNode | null => {
    const sim = simRef.current;
    if (!sim) return null;
    const nodes = sim.nodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const p = toScreen(node);
      const r = renderRadius(node) + 2;
      if ((sx - p.x) ** 2 + (sy - p.y) ** 2 <= r * r) return node;
    }
    return null;
  };

  // Pointer interaction state kept in refs (no re-render per mouse move).
  const drag = useRef<{
    node: GraphNode | null;
    panning: boolean;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  const localPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { sx, sy } = localPoint(e);
    const node = nodeAt(sx, sy);
    drag.current = { node, panning: !node, startX: sx, startY: sy, moved: false };
    if (node && simRef.current) {
      simRef.current.alphaTarget(0.2).restart();
      node.fx = node.x;
      node.fy = node.y;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { sx, sy } = localPoint(e);
    const d = drag.current;
    if (!d) {
      // Hover handling.
      const node = nodeAt(sx, sy);
      if (node !== hoverRef.current) {
        hoverRef.current = node;
        setTooltip(node ? { node, sx, sy } : null);
        draw();
      } else if (node) {
        setTooltip({ node, sx, sy });
      }
      e.currentTarget.style.cursor = node ? "pointer" : "grab";
      return;
    }
    if (Math.abs(sx - d.startX) > CLICK_MOVE_TOL || Math.abs(sy - d.startY) > CLICK_MOVE_TOL) {
      d.moved = true;
    }
    const t = transformRef.current;
    if (d.node) {
      d.node.fx = (sx - t.x) / t.k;
      d.node.fy = (sy - t.y) / t.k;
      draw();
    } else if (d.panning) {
      transformRef.current = {
        k: t.k,
        x: t.x + (sx - d.startX),
        y: t.y + (sy - d.startY),
      };
      d.startX = sx;
      d.startY = sy;
      draw();
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    drag.current = null;
    if (simRef.current) simRef.current.alphaTarget(0);
    if (!d) return;
    if (d.node) {
      // Release the pin so it rejoins the layout.
      d.node.fx = null;
      d.node.fy = null;
      if (!d.moved) onSelectNode(d.node);
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const node = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (node) onReseedNode(node);
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const t = transformRef.current;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const k = Math.min(6, Math.max(0.1, t.k * factor));
    // Zoom around the cursor.
    transformRef.current = {
      k,
      x: sx - ((sx - t.x) / t.k) * k,
      y: sy - ((sy - t.y) / t.k) * k,
    };
    draw();
  };

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          if (!drag.current) {
            hoverRef.current = null;
            setTooltip(null);
            draw();
          }
        }}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
      />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 max-w-56 rounded-md border bg-background/95 px-2.5 py-1.5 text-xs shadow-md backdrop-blur"
          style={{
            left: Math.min(tooltip.sx + 12, viewWidth - 180),
            top: tooltip.sy + 12,
          }}
        >
          <div className="font-medium">{tooltip.node.label}</div>
          <div className="text-muted-foreground">
            {tooltip.node.type === "operator"
              ? `${tooltip.node.weight.toLocaleString()} wells${
                  tooltip.node.status ? ` · ${tooltip.node.status}` : ""
                }`
              : `${tooltip.node.weight.toLocaleString()} operators${
                  tooltip.node.role ? ` · ${tooltip.node.role}` : ""
                }`}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            click to open · double-click to focus
          </div>
        </div>
      )}
    </div>
  );
}
