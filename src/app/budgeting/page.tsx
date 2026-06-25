import { getTransactions } from "@/lib/budgeting/ledger";
import { getUploads } from "@/lib/budgeting/uploads";
import { getBudgetCategories } from "@/lib/budgeting/categories";
import { BudgetingWorkspace } from "@/components/budgeting/budgeting-workspace";

export default async function BudgetingPage() {
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
