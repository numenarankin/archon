import "server-only";

import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { BusinessUnitKey, Deal, PipelineStage } from "@/lib/numena/pipeline";

type Sb = Awaited<ReturnType<typeof getSupabaseServer>>;

export interface PipelineData {
  stages: PipelineStage[];
  deals: Deal[];
}

const EMPTY: PipelineData = { stages: [], deals: [] };

/** Resolve a business unit's default pipeline id (its only pipeline today). */
export async function defaultPipelineId(
  sb: Sb,
  buKey: BusinessUnitKey
): Promise<string | null> {
  const { data: bu } = await sb
    .from("business_units")
    .select("id")
    .eq("key", buKey)
    .maybeSingle();
  const buId = (bu as { id: string } | null)?.id;
  if (!buId) return null;
  const { data: pipe } = await sb
    .from("crm_pipelines")
    .select("id")
    .eq("business_unit_id", buId)
    .order("is_default", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (pipe as { id: string } | null)?.id ?? null;
}

interface DealRow {
  id: string;
  name: string;
  amount: number | null;
  stage_id: string;
  close_date: string | null;
  probability: number | null;
  custom: { company?: string; owner?: string; note?: string } | null;
  crm_accounts: { name: string | null } | null;
}

function mapDeal(r: DealRow): Deal {
  const custom = r.custom ?? {};
  return {
    id: r.id,
    name: r.name,
    company: r.crm_accounts?.name ?? custom.company ?? "",
    value: Number(r.amount ?? 0),
    stageId: r.stage_id,
    owner: custom.owner ?? undefined,
    closeDate: r.close_date ?? undefined,
    probability: r.probability ?? undefined,
    note: custom.note ?? undefined,
  };
}

/** The pipeline board's stages (columns) and deals for a business unit. */
export async function getPipelineData(
  buKey: BusinessUnitKey
): Promise<PipelineData> {
  if (!hasSupabase()) return EMPTY;
  try {
    const sb = await getSupabaseServer();
    const pipelineId = await defaultPipelineId(sb, buKey);
    if (!pipelineId) return EMPTY;

    const [{ data: stageRows }, { data: dealRows }] = await Promise.all([
      sb
        .from("crm_pipeline_stages")
        .select("id, name, is_won, is_lost")
        .eq("pipeline_id", pipelineId)
        .order("sort_order", { ascending: true }),
      sb
        .from("crm_deals")
        .select(
          "id, name, amount, stage_id, close_date, probability, custom, crm_accounts ( name )"
        )
        .eq("pipeline_id", pipelineId)
        .order("created_at", { ascending: false }),
    ]);

    const stages: PipelineStage[] = (
      (stageRows ?? []) as {
        id: string;
        name: string;
        is_won: boolean;
        is_lost: boolean;
      }[]
    ).map((s) => ({
      id: s.id,
      label: s.name,
      isWon: s.is_won,
      isLost: s.is_lost,
    }));

    const deals = ((dealRows ?? []) as unknown as DealRow[]).map(mapDeal);
    return { stages, deals };
  } catch (error) {
    console.error("[pipeline] getPipelineData failed:", error);
    return EMPTY;
  }
}
