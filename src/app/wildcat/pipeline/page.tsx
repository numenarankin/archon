import { getDeals } from "@/lib/numena/pipeline";
import { PipelineBoard } from "@/components/numena/pipeline-board";

export default async function PipelinePage() {
  const deals = await getDeals();

  return <PipelineBoard deals={deals} />;
}
