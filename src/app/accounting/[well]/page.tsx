import { notFound } from "next/navigation";
import { getWellLedger } from "@/lib/accounting/ledger";
import { getWellRoyaltyOwners } from "@/lib/people/people";
import { WellAccountingWorkspace } from "@/components/accounting/well-accounting-workspace";
import { SetPageBreadcrumb } from "@/components/breadcrumb-context";
import type { InterestOwner } from "@/lib/accounting/derive";

export default async function AccountingWellPage({
  params,
}: {
  params: Promise<{ well: string }>;
}) {
  const { well } = await params;
  const ledger = await getWellLedger(well);

  if (!ledger) {
    notFound();
  }

  const owners = await getWellRoyaltyOwners(well);
  const interestOwners: InterestOwner[] = owners.map((o) => ({
    id: o.id,
    name: o.name,
    interestType: o.interestType,
    decimalInterest: o.decimalInterest,
  }));

  return (
    <>
      <SetPageBreadcrumb label={ledger.wellName} />
      <WellAccountingWorkspace
        wellId={well}
        wellName={ledger.wellName}
        transactions={ledger.transactions}
        owners={interestOwners}
      />
    </>
  );
}
