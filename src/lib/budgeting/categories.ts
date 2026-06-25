import { z } from "zod";
import type { TransactionKind } from "@/lib/budgeting/types";

/**
 * A budget category and its code. Personal budgeting ships a built-in set
 * (`DEFAULT_CATEGORIES`); there's no per-org chart of accounts to configure.
 */
export interface Category {
  code: string;
  label: string;
  kind: TransactionKind;
}

/** Schema for a category list (used to validate model-extracted codes). */
export const categoriesSchema = z
  .array(
    z.object({
      code: z.string().trim().min(1, "code is required"),
      label: z.string().trim().min(1, "label is required"),
      kind: z.enum(["income", "expense"]),
    })
  )
  .min(1, "Add at least one category");

/** Built-in personal-budget categories. */
export const DEFAULT_CATEGORIES: Category[] = [
  // Income
  { code: "INC-SAL", label: "Salary & Wages", kind: "income" },
  { code: "INC-BON", label: "Bonus", kind: "income" },
  { code: "INC-INT", label: "Interest & Dividends", kind: "income" },
  { code: "INC-GIF", label: "Gifts Received", kind: "income" },
  { code: "INC-REF", label: "Refunds & Reimbursements", kind: "income" },
  { code: "INC-OTH", label: "Other Income", kind: "income" },
  // Expense
  { code: "EXP-HOUS", label: "Housing & Rent", kind: "expense" },
  { code: "EXP-UTIL", label: "Utilities", kind: "expense" },
  { code: "EXP-GROC", label: "Groceries", kind: "expense" },
  { code: "EXP-DINE", label: "Dining & Takeout", kind: "expense" },
  { code: "EXP-TRAN", label: "Transportation", kind: "expense" },
  { code: "EXP-HEAL", label: "Health & Medical", kind: "expense" },
  { code: "EXP-INSU", label: "Insurance", kind: "expense" },
  { code: "EXP-SUBS", label: "Subscriptions", kind: "expense" },
  { code: "EXP-ENT", label: "Entertainment", kind: "expense" },
  { code: "EXP-SHOP", label: "Shopping", kind: "expense" },
  { code: "EXP-TRAV", label: "Travel", kind: "expense" },
  { code: "EXP-EDU", label: "Education", kind: "expense" },
  { code: "EXP-DEBT", label: "Debt & Loan Payments", kind: "expense" },
  { code: "EXP-SAVE", label: "Savings & Investments", kind: "expense" },
  { code: "EXP-GIFT", label: "Gifts & Donations", kind: "expense" },
  { code: "EXP-OTH", label: "Other Expense", kind: "expense" },
];

/** Categories of a given kind, from a supplied list. */
export function categoriesFor(
  categories: Category[],
  kind: TransactionKind
): Category[] {
  return categories.filter((c) => c.kind === kind);
}

/** The active category list. Personal budgeting uses the built-in set. */
export function getBudgetCategories(): Category[] {
  return DEFAULT_CATEGORIES;
}
