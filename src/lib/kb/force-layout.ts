/**
 * A tiny dependency-free force-directed layout (Fruchterman-Reingold style).
 *
 * The project ships d3-zoom/selection but not d3-force, so this provides just
 * enough simulation to lay out the knowledge graph: pairwise repulsion, spring
 * attraction along edges, and gravity toward the center, with a cooling `alpha`.
 * It mutates node positions in place; the view ticks it on requestAnimationFrame.
 */

export interface ForceNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface ForceLink {
  source: string;
  target: string;
}

const ALPHA_MIN = 0.005;
const ALPHA_DECAY = 0.97;
const DAMPING = 0.85;

export class ForceSimulation {
  readonly nodes: ForceNode[];
  private readonly links: ForceLink[];
  private readonly byId: Map<string, ForceNode>;
  private readonly fixed = new Map<string, { x: number; y: number }>();
  private alpha = 1;
  private readonly ideal: number;

  constructor(
    ids: string[],
    links: ForceLink[],
    private width: number,
    private height: number
  ) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2.5;
    // Deterministic ring start (no RNG → stable, SSR-safe).
    this.nodes = ids.map((id, i) => {
      const angle = (i / Math.max(ids.length, 1)) * Math.PI * 2;
      return {
        id,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });
    this.byId = new Map(this.nodes.map((n) => [n.id, n]));
    this.links = links.filter(
      (l) => this.byId.has(l.source) && this.byId.has(l.target)
    );
    this.ideal = Math.max(
      40,
      Math.sqrt((width * height) / Math.max(ids.length, 1)) * 0.55
    );
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  reheat(value = 0.6): void {
    this.alpha = Math.max(this.alpha, value);
  }

  setFixed(id: string, pos: { x: number; y: number } | null): void {
    if (pos) this.fixed.set(id, pos);
    else this.fixed.delete(id);
  }

  /** Advance one step; returns the current alpha (≈0 when settled). */
  tick(): number {
    if (this.alpha <= ALPHA_MIN) return this.alpha;
    const { nodes, ideal, alpha } = this;
    const k = ideal;

    // Repulsion (every pair).
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 === 0) {
          dx = (i - j) * 0.5 + 0.5;
          dy = 0.5;
          d2 = dx * dx + dy * dy;
        }
        const force = ((k * k) / d2) * alpha;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // Spring attraction along edges.
    for (const link of this.links) {
      const a = this.byId.get(link.source)!;
      const b = this.byId.get(link.target)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = ((d - k) / k) * alpha * 6;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Center gravity + integrate.
    const cx = this.width / 2;
    const cy = this.height / 2;
    for (const n of nodes) {
      const pinned = this.fixed.get(n.id);
      if (pinned) {
        n.x = pinned.x;
        n.y = pinned.y;
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      n.vx += (cx - n.x) * 0.01 * alpha;
      n.vy += (cy - n.y) * 0.01 * alpha;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += Math.max(-30, Math.min(30, n.vx));
      n.y += Math.max(-30, Math.min(30, n.vy));
      // Keep within bounds with a small margin.
      n.x = Math.max(20, Math.min(this.width - 20, n.x));
      n.y = Math.max(20, Math.min(this.height - 20, n.y));
    }

    this.alpha *= ALPHA_DECAY;
    return this.alpha;
  }
}

/** A stable, readable color per tag slug, for coloring nodes and the filter rail. */
const PALETTE = [
  "#60a5fa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#22d3ee",
  "#fb7185",
  "#4ade80",
  "#e879f9",
  "#facc15",
];

export function colorForTag(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
