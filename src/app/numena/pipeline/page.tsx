import { getPipelineData } from "@/lib/numena/pipeline-data";
import { PipelineBoard } from "@/components/numena/pipeline-board";
import { requirePermission } from "@/lib/auth/permissions";

export default async function PipelinePage() {
  await requirePermission("view_pipeline");
  const { stages, deals } = await getPipelineData("numena");

  return <PipelineBoard stages={stages} deals={deals} buKey="numena" />;
}
