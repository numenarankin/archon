import { requirePermission } from "@/lib/auth/permissions";
import {
  getCallHistory,
  getQueue,
  getSalesConfig,
} from "@/lib/wildcat/sales-data";
import { hasTelnyx } from "@/lib/wildcat/telephony/telnyx";
import { SalesWorkspace } from "@/components/wildcat/sales/sales-workspace";

/**
 * The Numena sales desk — the same workspace as /wildcat/sales, scoped to the
 * Numena business unit. Issuers added from the prospecting page land here in the
 * Unscheduled column. Gated by the Prospecting page capability.
 */
export default async function NumenaSalesPage() {
  await requirePermission("view_prospects");
  const [prospects, history, config] = await Promise.all([
    getQueue("numena"),
    getCallHistory("numena"),
    getSalesConfig(),
  ]);

  return (
    <SalesWorkspace
      prospects={prospects}
      history={history}
      config={config}
      telephonyEnabled={hasTelnyx()}
    />
  );
}
