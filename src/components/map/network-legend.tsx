"use client";

// Small bottom-left legend for the Network view: what node colors mean under the
// current color mode, and the size encoding. Mirrors the palette in graph-style.
import type { ColorMode } from "@/lib/wells/graph-style";

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block size-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

const LEGENDS: Record<ColorMode, { color: string; label: string }[]> = {
  type: [
    { color: "#2563eb", label: "Operator" },
    { color: "#7c3aed", label: "Person" },
  ],
  status: [
    { color: "#16a34a", label: "Active" },
    { color: "#9ca3af", label: "Inactive" },
    { color: "#dc2626", label: "Delinquent" },
    { color: "#7c3aed", label: "Person" },
  ],
  role: [
    { color: "#7c3aed", label: "Filing agent" },
    { color: "#0d9488", label: "Agent" },
    { color: "#475569", label: "Officer" },
    { color: "#2563eb", label: "Operator" },
  ],
};

export function NetworkLegend({ colorMode }: { colorMode: ColorMode }) {
  return (
    <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 rounded-lg border bg-background/95 p-2.5 text-xs shadow-lg backdrop-blur">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {LEGENDS[colorMode].map((l) => (
          <Swatch key={l.label} color={l.color} label={l.label} />
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground">
        Node size: operators by wells, people by operators connected
      </div>
    </div>
  );
}
