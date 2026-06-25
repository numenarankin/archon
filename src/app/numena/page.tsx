import {
  getBusinessDevelopers,
  getFilings,
  getInvestors,
} from "@/lib/numena/prospecting";
import { ProspectingWorkspace } from "@/components/numena/prospecting-workspace";

export default async function NumenaPage() {
  const [filings, investors, bds] = await Promise.all([
    getFilings(),
    getInvestors(),
    getBusinessDevelopers(),
  ]);

  return (
    <ProspectingWorkspace filings={filings} investors={investors} bds={bds} />
  );
}
