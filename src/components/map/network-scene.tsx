"use client";

// Orchestrates the Network view: picks the right graph query from the current
// seed/role, renders the canvas graph + legend + a scope badge + a ranked
// "Top hubs" list, and routes node interactions to the existing detail panels
// (single click) or reseeds the graph (double click / hub-list click).
import { useEffect, useMemo, useState } from "react";
import { Loader2, Crosshair, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NetworkGraph } from "./network-graph";
import { NetworkLegend } from "./network-legend";
import type { Filters } from "./map-filters";
import {
  getHubGraph,
  getSubgraph,
  getTopHubs,
  type TopHub,
} from "@/lib/wells/network";
import type { GraphData, GraphNode } from "@/lib/wells/graph-style";
import { COUNTY_NAMES } from "@/lib/wells/counties";

interface NetworkSceneProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  onSelectOperator: (operatorNumber: number) => void;
  onSelectPrincipal: (name: string) => void;
}

const EMPTY: GraphData = { nodes: [], links: [] };

export function NetworkScene({
  filters,
  onChange,
  onSelectOperator,
  onSelectPrincipal,
}: NetworkSceneProps) {
  const [data, setData] = useState<GraphData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hubs, setHubs] = useState<TopHub[]>([]);
  const [showHubs, setShowHubs] = useState(false);

  const seed = useMemo(
    () => ({
      person: filters.networkPerson,
      operator: filters.operator?.operator_number ?? null,
      county: filters.county === "all" ? null : filters.county,
    }),
    [filters.networkPerson, filters.operator, filters.county],
  );
  const seeded = Boolean(seed.person || seed.operator || seed.county);

  const scopeLabel = seed.person
    ? seed.person
    : filters.operator
      ? filters.operator.operator_name
      : seed.county
        ? `${COUNTY_NAMES[seed.county] ?? `County ${seed.county}`} County`
        : filters.networkRole === "filing"
          ? "Top filing hubs"
          : filters.networkRole === "agent"
            ? "Top agents"
            : "Top hubs";

  // Load the graph for the current seed/role.
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const g = await (seeded
          ? getSubgraph(seed, filters.networkMinWells)
          : getHubGraph(filters.networkRole, filters.networkMinWells));
        if (active) setData(g);
      } catch (e: unknown) {
        if (active) {
          setData(EMPTY);
          setError(e instanceof Error ? e.message : "Could not load network.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [seed, seeded, filters.networkRole, filters.networkMinWells]);

  // Load the ranked hub list (drives the "Top hubs" flyout).
  useEffect(() => {
    let active = true;
    getTopHubs(filters.networkRole)
      .then((h) => active && setHubs(h))
      .catch(() => active && setHubs([]));
    return () => {
      active = false;
    };
  }, [filters.networkRole]);

  const handleSelectNode = (n: GraphNode) => {
    if (n.type === "operator" && n.opNumber != null) onSelectOperator(n.opNumber);
    else if (n.type === "person" && n.name) onSelectPrincipal(n.name);
  };

  const reseedPerson = (name: string) =>
    onChange({ ...filters, networkPerson: name, operator: null, county: "all" });

  const handleReseedNode = (n: GraphNode) => {
    if (n.type === "person" && n.name) {
      reseedPerson(n.name);
    } else if (n.type === "operator" && n.opNumber != null) {
      onChange({
        ...filters,
        operator: { operator_number: n.opNumber, operator_name: n.label },
        networkPerson: null,
        county: "all",
      });
    }
  };

  const clearSeed = () =>
    onChange({ ...filters, networkPerson: null, operator: null, county: "all" });

  return (
    <div className="absolute inset-0 z-0 bg-[#f6f7f9]">
      {/* Scope badge */}
      <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs shadow-md backdrop-blur">
        <span className="font-medium">{scopeLabel}</span>
        <span className="text-muted-foreground">
          {data.nodes.length.toLocaleString()} nodes · {data.links.length.toLocaleString()} links
        </span>
        {seeded && (
          <button className="text-primary hover:underline" onClick={clearSeed}>
            reset
          </button>
        )}
      </div>

      {/* Top-hubs flyout toggle */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
        <Button size="xs" variant="outline" onClick={() => setShowHubs((v) => !v)}>
          <ListTree className="size-3.5" />
          Top hubs
        </Button>
        {showHubs && (
          <div className="max-h-[60vh] w-72 overflow-y-auto rounded-lg border bg-background/95 p-1 text-sm shadow-xl backdrop-blur">
            {hubs.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No hubs found.</p>
            ) : (
              <ul className="divide-y">
                {hubs.map((h) => (
                  <li key={h.officer_name}>
                    <button
                      onClick={() => {
                        reseedPerson(h.officer_name);
                        setShowHubs(false);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{h.officer_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {h.operator_count} operators
                          {h.is_filing_agent ? " · filing agent" : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {h.total_wells.toLocaleString()} wells
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* States */}
      {loading && (
        <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-md border bg-background/95 px-3 py-2 text-sm shadow-md">
          <Loader2 className="size-4 animate-spin" />
          Building network…
        </div>
      )}
      {error && !loading && (
        <div className="absolute left-1/2 top-1/2 z-10 max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background p-4 text-center text-sm shadow-md">
          <p className="font-medium">Network unavailable</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Apply the operator-network migration and refresh its materialized views.
          </p>
        </div>
      )}
      {!loading && !error && data.nodes.length === 0 && (
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">
          <Crosshair className="mx-auto mb-2 size-5" />
          No connections for this scope.
        </div>
      )}

      <NetworkGraph
        data={data}
        colorMode={filters.networkColor}
        onSelectNode={handleSelectNode}
        onReseedNode={handleReseedNode}
      />
      <NetworkLegend colorMode={filters.networkColor} />
    </div>
  );
}
