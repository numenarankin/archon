import { requirePermission } from "@/lib/auth/permissions";
import {
  getCallHistory,
  getQueue,
  getSalesConfig,
} from "@/lib/wildcat/sales-data";
import { SalesWorkspace } from "@/components/wildcat/sales/sales-workspace";

export default async function SalesPage() {
  await requirePermission("view_prospects");
  const [prospects, history, config] = await Promise.all([
    getQueue(),
    getCallHistory(),
    getSalesConfig(),
  ]);

  return (
    <SalesWorkspace prospects={prospects} history={history} config={config} />
  );
}
