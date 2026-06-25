import { getCallHistory, getQueuedProspects } from "@/lib/wildcat/sales";
import { SalesWorkspace } from "@/components/wildcat/sales/sales-workspace";

export default async function SalesPage() {
  const [prospects, history] = await Promise.all([
    getQueuedProspects(),
    getCallHistory(),
  ]);

  return <SalesWorkspace prospects={prospects} history={history} />;
}
