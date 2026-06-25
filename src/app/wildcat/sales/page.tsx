import { getQueuedProspects } from "@/lib/wildcat/sales";
import { SalesWorkspace } from "@/components/wildcat/sales/sales-workspace";

export default async function SalesPage() {
  const prospects = await getQueuedProspects();

  return <SalesWorkspace prospects={prospects} />;
}
