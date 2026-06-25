import { getDeals } from "@/lib/numena/pipeline";
import { PipelineBoard } from "@/components/numena/pipeline-board";
import { requirePermission } from "@/lib/auth/permissions";

export default async function PipelinePage() {
  await requirePermission("view_prospects");
  const deals = await getDeals();

  return <PipelineBoard deals={deals} />;
}
