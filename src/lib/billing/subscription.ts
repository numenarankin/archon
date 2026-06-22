import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import { hasSupabase, isPaidMode } from "@/lib/env";
import { tierByKey, type TierKey } from "@/lib/billing/tiers";

/** The current org's subscription, as the UI and guards need it. */
export interface OrgSubscription {
  tier: TierKey;
  status: string;
  wellCap: number;
  monthlyCredits: number;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripe: boolean;
}

interface SubscriptionRow {
  tier: string;
  status: string;
  well_cap: number;
  monthly_credits: number;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
}

/** Read the current org's subscription (RLS-scoped), or null if none/unset. */
export async function getSubscription(): Promise<OrgSubscription | null> {
  if (!hasSupabase()) return null;
  try {
    const sb = await getSupabaseServer();
    const { data, error } = await sb
      .from("subscriptions")
      .select(
        "tier, status, well_cap, monthly_credits, current_period_end, trial_end, cancel_at_period_end, stripe_subscription_id"
      )
      .maybeSingle<SubscriptionRow>();
    if (error || !data) return null;
    return {
      tier: tierByKey(data.tier).key,
      status: data.status,
      wellCap: Number(data.well_cap ?? 0),
      monthlyCredits: Number(data.monthly_credits ?? 0),
      currentPeriodEnd: data.current_period_end,
      trialEnd: data.trial_end,
      cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
      hasStripe: Boolean(data.stripe_subscription_id),
    };
  } catch {
    return null;
  }
}

/** Thrown when a create would exceed the org's plan well cap. */
export class WellCapReachedError extends Error {
  readonly cap: number;
  constructor(cap: number) {
    super(
      `Your plan allows up to ${cap} wells. Upgrade your subscription to add more.`
    );
    this.name = "WellCapReachedError";
    this.cap = cap;
  }
}

/**
 * Block well creation once the org hits its tier's well cap. Fails open when
 * billing isn't configured or there's no subscription row yet (dev), so the app
 * keeps working before billing is wired. Pass the request-scoped client so the
 * subscription + count reads are RLS-scoped to the caller's org.
 */
export async function assertWellCapacity(sb: SupabaseClient): Promise<void> {
  // Master switch off → no cap enforcement.
  if (!isPaidMode()) return;
  if (!hasSupabase()) return;
  const { data: sub } = await sb
    .from("subscriptions")
    .select("well_cap")
    .maybeSingle<{ well_cap: number }>();
  const cap = Number(sub?.well_cap ?? 0);
  if (!sub || cap <= 0) return; // no plan / unlimited → don't block

  const { count, error } = await sb
    .from("wells")
    .select("id", { count: "exact", head: true });
  if (error) return; // don't block on a count error
  if ((count ?? 0) >= cap) throw new WellCapReachedError(cap);
}
