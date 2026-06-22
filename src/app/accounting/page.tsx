import { getTransactions } from "@/lib/accounting/ledger";
import { getUploads } from "@/lib/accounting/uploads";
import { getAccountingCategories } from "@/lib/accounting/org-categories";
import { getWells } from "@/lib/wells/wells";
import { getRoyaltyOwners } from "@/lib/people/people";
import { AccountingWorkspace } from "@/components/accounting/accounting-workspace";
import type { InterestOwner } from "@/lib/accounting/derive";
import { requirePermission } from "@/lib/auth/permissions";

export default async function AccountingPage() {
  await requirePermission(["view_accounting", "manage_accounting"]);
  const [transactions, wells, royaltyOwners, categories, uploads] =
    await Promise.all([
      getTransactions(),
      getWells(),
      getRoyaltyOwners(),
      getAccountingCategories(),
      getUploads(),
    ]);

  // Group interest owners by well, for the monthly report distributions.
  const ownersByWell: Record<string, InterestOwner[]> = {};
  for (const o of royaltyOwners) {
    for (const wellId of o.wellIds) {
      (ownersByWell[wellId] ??= []).push({
        id: o.id,
        name: o.name,
        interestType: o.interestType,
        decimalInterest: o.decimalInterest,
      });
    }
  }

  return (
    <AccountingWorkspace
      transactions={transactions}
      wells={wells.map((w) => ({ id: w.id, name: w.name }))}
      ownersByWell={ownersByWell}
      categories={categories}
      uploads={uploads}
    />
  );
}
