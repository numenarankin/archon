import "server-only";
import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  DEFAULT_CATEGORIES,
  categoriesSchema,
  type Category,
} from "@/lib/accounting/categories";

/**
 * The caller's organization chart of accounts, or the built-in sample list when
 * the org hasn't configured one (or has stored something invalid). Resolved via
 * RLS — no need to pass the org id.
 */
export async function getAccountingCategories(): Promise<Category[]> {
  if (!hasSupabase()) return DEFAULT_CATEGORIES;
  try {
    const sb = await getSupabaseServer();
    const { data, error } = await sb
      .from("organizations")
      .select("accounting_categories")
      .maybeSingle();
    if (error) throw error;

    const stored = data?.accounting_categories;
    if (!stored) return DEFAULT_CATEGORIES;

    const parsed = categoriesSchema.safeParse(stored);
    return parsed.success ? parsed.data : DEFAULT_CATEGORIES;
  } catch (error) {
    console.error("getAccountingCategories failed", error);
    return DEFAULT_CATEGORIES;
  }
}
