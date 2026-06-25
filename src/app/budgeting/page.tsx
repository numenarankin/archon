import { getTransactions } from "@/lib/budgeting/ledger";
import { getUploads } from "@/lib/budgeting/uploads";
import { getBudgetCategories } from "@/lib/budgeting/categories";
import { BudgetingWorkspace } from "@/components/budgeting/budgeting-workspace";
import { requirePermission } from "@/lib/auth/permissions";

export default async function BudgetingPage() {
  await requirePermission("view_budgeting");
  const [transactions, uploads] = await Promise.all([
    getTransactions(),
    getUploads(),
  ]);
  const categories = getBudgetCategories();

  return (
    <BudgetingWorkspace
      transactions={transactions}
      categories={categories}
      uploads={uploads}
    />
  );
}
