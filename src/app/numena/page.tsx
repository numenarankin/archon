import {
  getBusinessDevelopers,
  getFilings,
  getInvestors,
} from "@/lib/numena/prospecting";
import { ProspectingWorkspace } from "@/components/numena/prospecting-workspace";
import { requirePermission } from "@/lib/auth/permissions";

export default async function NumenaPage() {
  await requirePermission("view_prospects");
  const [filings, investors, bds] = await Promise.all([
    getFilings(),
    getInvestors(),
    getBusinessDevelopers(),
  ]);

  return (
    <ProspectingWorkspace filings={filings} investors={investors} bds={bds} />
  );
}
