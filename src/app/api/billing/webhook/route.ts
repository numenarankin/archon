import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe, getWebhookSecret } from "@/lib/billing/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hasStripe } from "@/lib/env";
import { TIERS, tierByKey, isTierKey, type TierKey } from "@/lib/billing/tiers";

// Stripe's SDK needs Node APIs (crypto for signature verification) — not edge.
export const runtime = "nodejs";

/** Unix seconds → ISO string, or null. */
function toIso(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/** Reverse map: Stripe Price ID → tier key, built from the per-tier env vars. */
function tierFromPriceId(priceId: string | undefined): TierKey | null {
  if (!priceId) return null;
  for (const t of TIERS) {
    if (t.priceEnvKey && process.env[t.priceEnvKey] === priceId) return t.key;
  }
  return null;
}

/** The billing-period window — top-level on the subscription, or on its item. */
function periodWindow(sub: Stripe.Subscription): {
  start: number | null;
  end: number | null;
} {
  const loose = sub as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const item = sub.items?.data?.[0] as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  return {
    start: loose.current_period_start ?? item?.current_period_start ?? null,
    end: loose.current_period_end ?? item?.current_period_end ?? null,
  };
}

/** Find the org id for a Stripe customer via our subscriptions table. */
async function orgIdForCustomer(
  admin: SupabaseClient,
  customerId: string | null
): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await admin
    .from("subscriptions")
    .select("org_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle<{ org_id: string }>();
  return data?.org_id ?? null;
}

/** Upsert our subscription row from a Stripe Subscription object. */
async function syncSubscription(
  admin: SupabaseClient,
  sub: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

  const orgId =
    (sub.metadata?.org_id as string | undefined) ??
    (await orgIdForCustomer(admin, customerId));
  if (!orgId) {
    console.error("syncSubscription: no org_id for subscription", sub.id);
    return;
  }

  const metaTier = sub.metadata?.tier;
  const tierKey: TierKey = isTierKey(metaTier)
    ? metaTier
    : tierFromPriceId(sub.items?.data?.[0]?.price?.id) ?? "tier_1";
  const tier = tierByKey(tierKey);
  const period = periodWindow(sub);

  const { error } = await admin.from("subscriptions").upsert(
    {
      org_id: orgId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      tier: tier.key,
      status: sub.status,
      well_cap: tier.wellCap,
      monthly_credits: tier.monthlyCredits,
      current_period_start: toIso(period.start),
      current_period_end: toIso(period.end),
      trial_end: toIso(sub.trial_end),
      cancel_at_period_end: sub.cancel_at_period_end,
    },
    { onConflict: "org_id" }
  );
  if (error) console.error("syncSubscription upsert failed", error.message);
}

/**
 * Reward the referrer with one free month when a referred org converts, once per
 * referred org. The reward is an account credit (a negative customer balance) the
 * size of the referrer's current monthly plan — Stripe applies it automatically to
 * upcoming invoices, so it reliably "skips" their next charge no matter where they
 * are in their subscription, and multiple referrals stack instead of overwriting.
 */
async function maybeRewardReferrer(
  admin: SupabaseClient,
  orgId: string
): Promise<void> {
  const { data: org } = await admin
    .from("organizations")
    .select("referred_by_org")
    .eq("id", orgId)
    .maybeSingle<{ referred_by_org: string | null }>();
  const referrerOrg = org?.referred_by_org;
  if (!referrerOrg) return;

  // Claim the reward atomically: insert wins exactly once (unique referred_org).
  const { data: claimed } = await admin
    .from("referral_rewards")
    .upsert(
      { referred_org: orgId, referrer_org: referrerOrg },
      { onConflict: "referred_org", ignoreDuplicates: true }
    )
    .select("id");
  if (!claimed || claimed.length === 0) return; // already rewarded

  const { data: referrerSub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id, tier")
    .eq("org_id", referrerOrg)
    .maybeSingle<{ stripe_customer_id: string | null; tier: string }>();

  // One month of the referrer's current plan, in cents. Contact-sales tiers have
  // no self-serve price, so there's nothing to credit.
  const monthlyUsd = tierByKey(referrerSub?.tier).monthlyUsd;
  if (referrerSub?.stripe_customer_id && monthlyUsd) {
    await getStripe().customers.createBalanceTransaction(
      referrerSub.stripe_customer_id,
      {
        amount: -Math.round(monthlyUsd * 100),
        currency: "usd",
        description: "Referral reward — 1 month free",
        metadata: { referrer_org: referrerOrg, referred_org: orgId },
      }
    );
  }
  await admin
    .from("referral_rewards")
    .update({ rewarded_at: new Date().toISOString() })
    .eq("referred_org", orgId);
}

export async function POST(req: Request) {
  if (!hasStripe()) {
    return new Response("Billing not configured", { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const stripe = getStripe();
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, getWebhookSecret());
  } catch (err) {
    const msg = err instanceof Error ? err.message : "bad signature";
    return new Response(`Webhook signature verification failed: ${msg}`, {
      status: 400,
    });
  }

  const admin = getSupabaseAdmin();

  // Idempotency: claim the event id; if already seen, ack without reprocessing.
  const { data: claimed, error: claimErr } = await admin
    .from("stripe_events")
    .upsert(
      { id: event.id, type: event.type },
      { onConflict: "id", ignoreDuplicates: true }
    )
    .select("id");
  if (claimErr) {
    console.error("stripe_events claim failed", claimErr.message);
  } else if (!claimed || claimed.length === 0) {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "setup_intent.succeeded": {
        // A card was saved via the card-only Elements form (createCardSetupIntent).
        // Make it the customer's default so off-session top-up charges can use it.
        const si = event.data.object as Stripe.SetupIntent;
        if (si.metadata?.kind === "save_card") {
          const pm =
            typeof si.payment_method === "string"
              ? si.payment_method
              : si.payment_method?.id;
          const customerId =
            typeof si.customer === "string" ? si.customer : si.customer?.id;
          if (pm && customerId) {
            await stripe.customers.update(customerId, {
              invoice_settings: { default_payment_method: pm },
            });
          }
        }
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.kind === "topup") {
          const orgId = pi.metadata.org_id;
          const credits = Number(pi.metadata.credits ?? 0);
          if (orgId && credits > 0) {
            await admin.rpc("billing_add_paid", {
              p_org: orgId,
              p_amount: credits,
              p_reason: "top-up",
              p_meta: { payment_intent: pi.id },
            });
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(admin, event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        // Only a real conversion earns the referrer a reward — skip the $0
        // invoice Stripe issues when a trial subscription is first created.
        if ((invoice.amount_paid ?? 0) > 0) {
          const customerId =
            typeof invoice.customer === "string"
              ? invoice.customer
              : invoice.customer?.id ?? null;
          const orgId = await orgIdForCustomer(admin, customerId);
          if (orgId) await maybeRewardReferrer(admin, orgId);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id ?? null;
        const orgId = await orgIdForCustomer(admin, customerId);
        if (orgId) {
          await admin
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("org_id", orgId);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    // Log but still 200 so Stripe doesn't hammer retries on a transient error.
    console.error(`webhook handler error for ${event.type}`, err);
  }

  return Response.json({ received: true });
}
