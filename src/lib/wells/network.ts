// Client-side queries for the Map "Network" view. These call the SQL graph RPCs
// (see supabase/migrations/20260623000200_operator_network.sql) and assemble the
// flat affiliation edge rows into a deduped { nodes, links } graph the canvas
// renderer can lay out. Operators and people are nodes; affiliations are links.
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { GraphData, GraphLink, GraphNode } from "@/lib/wells/graph-style";

export type NetworkRole = "all" | "filing" | "agent";

/** One affiliation edge row as returned by the graph RPCs. */
interface EdgeRow {
  src_person: string;
  operator_number: number;
  operator_name: string | null;
  officer_title: string | null;
  p5_status: string | null;
  op_wells: number;
  person_operators: number;
  hop: number;
}

export interface TopHub {
  officer_name: string;
  operator_count: number;
  total_wells: number;
  is_filing_agent: boolean;
  is_agent: boolean;
}

function roleParam(role: NetworkRole): string | null {
  return role === "all" ? null : role;
}

/** Build a deduped node/link graph from a flat affiliation edge list. */
export function buildGraph(rows: EdgeRow[]): GraphData {
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  for (const r of rows) {
    const personId = `p:${r.src_person}`;
    const opId = `o:${r.operator_number}`;

    if (!nodes.has(personId)) {
      nodes.set(personId, {
        id: personId,
        type: "person",
        label: r.src_person,
        name: r.src_person,
        weight: r.person_operators || 1,
        role: r.officer_title,
      });
    }
    if (!nodes.has(opId)) {
      nodes.set(opId, {
        id: opId,
        type: "operator",
        label: r.operator_name ?? `Operator #${r.operator_number}`,
        weight: r.op_wells || 0,
        status: r.p5_status,
        opNumber: r.operator_number,
      });
    }
    links.push({ source: personId, target: opId, title: r.officer_title, hop: r.hop });
  }

  return { nodes: [...nodes.values()], links };
}

/** Default Network view: top hubs and the operators they connect (capped per
 * hub so one mega-hub does not crowd out the rest). minWells drops the tiny
 * one-well operators that otherwise form a noisy left tail. */
export async function getHubGraph(
  role: NetworkRole = "all",
  minWells = 20,
  hubLimit = 100,
  perHub = 18,
): Promise<GraphData> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("network_hub_graph", {
    p_role: roleParam(role),
    p_min_operators: 3,
    p_hub_limit: hubLimit,
    p_min_wells: minWells,
    p_per_hub: perHub,
  });
  if (error) throw new Error(`network_hub_graph: ${error.message}`);
  return buildGraph((data as EdgeRow[] | null) ?? []);
}

export interface SubgraphSeed {
  person?: string | null;
  operator?: number | null;
  county?: number | null;
}

/** Focused subgraph around a single person, operator, or county. */
export async function getSubgraph(
  seed: SubgraphSeed,
  minWells = 20,
): Promise<GraphData> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("network_subgraph", {
    p_person: seed.person ?? null,
    p_operator: seed.operator ?? null,
    p_county: seed.county ?? null,
    p_min_wells: minWells,
  });
  if (error) throw new Error(`network_subgraph: ${error.message}`);
  return buildGraph((data as EdgeRow[] | null) ?? []);
}

/** Ranked hub list for the controls panel (the "biggest filing partners"). */
export async function getTopHubs(
  role: NetworkRole = "all",
  minOperators = 2,
  limit = 60,
): Promise<TopHub[]> {
  const sb = getSupabaseBrowser();
  const { data, error } = await sb.rpc("network_top_hubs", {
    p_role: roleParam(role),
    p_min_operators: minOperators,
    p_limit: limit,
  });
  if (error) throw new Error(`network_top_hubs: ${error.message}`);
  return (data as TopHub[] | null) ?? [];
}
