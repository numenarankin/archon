"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { defaultPipelineId } from "@/lib/numena/pipeline-data";
import type { BusinessUnitKey } from "@/lib/numena/pipeline";

type Sb = Awaited<ReturnType<typeof getSupabaseServer>>;

function revalidate(): void {
  revalidatePath("/numena/pipeline");
  revalidatePath("/wildcat/pipeline");
}

/** A stage decides the deal's status: a won/lost stage closes it. */
async function statusForStage(sb: Sb, stageId: string): Promise<"open" | "won" | "lost"> {
  const { data } = await sb
    .from("crm_pipeline_stages")
    .select("is_won, is_lost")
    .eq("id", stageId)
    .maybeSingle();
  const s = data as { is_won: boolean; is_lost: boolean } | null;
  if (s?.is_won) return "won";
  if (s?.is_lost) return "lost";
  return "open";
}

export interface DealInput {
  name: string;
  company: string;
  value: number;
  stageId: string;
  owner?: string;
  closeDate?: string;
  probability?: number;
  note?: string;
}

function customFrom(input: DealInput) {
  return {
    company: input.company || null,
    owner: input.owner || null,
    note: input.note || null,
  };
}

/** Create a deal in a unit's default pipeline. Returns the new id. */
export async function createDeal(
  buKey: BusinessUnitKey,
  input: DealInput
): Promise<{ id: string }> {
  await requireUser();
  const sb = await getSupabaseServer();
  const pipelineId = await defaultPipelineId(sb, buKey);
  if (!pipelineId) throw new Error("No pipeline for this business unit.");
  const { data: bu } = await sb
    .from("business_units")
    .select("id")
    .eq("key", buKey)
    .maybeSingle();
  const businessUnitId = (bu as { id: string } | null)?.id;
  if (!businessUnitId) throw new Error("Business unit not found.");

  const status = await statusForStage(sb, input.stageId);
  const { data, error } = await sb
    .from("crm_deals")
    .insert({
      business_unit_id: businessUnitId,
      pipeline_id: pipelineId,
      stage_id: input.stageId,
      name: input.name,
      amount: input.value,
      close_date: input.closeDate || null,
      probability: input.probability ?? null,
      status,
      custom: customFrom(input),
    })
    .select("id")
    .single();
  if (error) throw new Error(`createDeal: ${error.message}`);
  revalidate();
  return { id: (data as { id: string }).id };
}

/** Edit an existing deal. */
export async function updateDeal(id: string, input: DealInput): Promise<void> {
  await requireUser();
  const sb = await getSupabaseServer();
  const status = await statusForStage(sb, input.stageId);
  const { error } = await sb
    .from("crm_deals")
    .update({
      stage_id: input.stageId,
      name: input.name,
      amount: input.value,
      close_date: input.closeDate || null,
      probability: input.probability ?? null,
      status,
      custom: customFrom(input),
    })
    .eq("id", id);
  if (error) throw new Error(`updateDeal: ${error.message}`);
  revalidate();
}

/** Move a deal to another stage (the kanban drag). Closes/opens it by stage. */
export async function moveDeal(id: string, stageId: string): Promise<void> {
  await requireUser();
  const sb = await getSupabaseServer();
  const status = await statusForStage(sb, stageId);
  const { error } = await sb
    .from("crm_deals")
    .update({ stage_id: stageId, status })
    .eq("id", id);
  if (error) throw new Error(`moveDeal: ${error.message}`);
  revalidate();
}

export async function deleteDeal(id: string): Promise<void> {
  await requireUser();
  const sb = await getSupabaseServer();
  const { error } = await sb.from("crm_deals").delete().eq("id", id);
  if (error) throw new Error(`deleteDeal: ${error.message}`);
  revalidate();
}
