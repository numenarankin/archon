"use server";

import { requireUser } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/permissions";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";
import {
  getPaymentMethods,
  type PaymentMethodInfo,
} from "@/lib/billing/payment-methods";
import { getAppUrl, hasStripe } from "@/lib/env";
import {
  TIERS,
  dollarsToTopUpCredits,
  isContactSales,
  isTierKey,
  tierByKey,
  type TierKey,
} from "@/lib/billing/tiers";

/**
 * Stripe checkout / portal / top-up server actions.
 *
 * Each returns a URL the client redirects to. Subscription state is written by
 * the webhook (see /api/billing/webhook), never here — these only create Stripe
 * sessions. The `org_id` travels in session/subscription/customer metadata so
 * the webhook can map events back to an org.
 */

interface OrgContext {
  orgId: string;
  name: string | null;
  email: string | null;
  referredByOrg: string | null;
  stripeCustomerId: string | null;
}

/** The org's Stripe subscription id, or null when it has never subscribed. */
async function currentSubscriptionId(orgId: string): Promise<string | null> {
  const sb = await getSupabaseServer();
  const { data } = await sb
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("org_id", orgId)
    .maybeSingle<{ stripe_subscription_id: string | null }>();
  return data?.stripe_subscription_id ?? null;
}

/** Resolve the signed-in user's org + its Stripe customer (if any). */
async function loadOrgContext(): Promise<OrgContext> {
  const user = await requireUser();
  const sb = await getSupabaseServer();

  const { data: orgId, error: orgErr } = await sb.rpc("current_org_id");
  if (orgErr || !orgId) throw new Error("No organization for the current user.");

  const { data: org } = await sb
    .from("organizations")
    .select("name, referred_by_org")
    .eq("id", orgId)
    .maybeSingle<{ name: string | null; referred_by_org: string | null }>();

  const { data: sub } = await sb
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("org_id", orgId)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  return {
    orgId: orgId as string,
    name: org?.name ?? null,
    email: user.email ?? null,
    referredByOrg: org?.referred_by_org ?? null,
    stripeCustomerId: sub?.stripe_customer_id ?? null,
  };
}

/** Reuse the org's Stripe customer, or create one and persist its id. */
async function ensureCustomer(ctx: OrgContext): Promise<string> {
  if (ctx.stripeCustomerId) return ctx.stripeCustomerId;
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: ctx.email ?? undefined,
    name: ctx.name ?? undefined,
    metadata: { org_id: ctx.orgId },
  });
  // Persist via admin (service role) so it survives regardless of RLS writes.
  await getSupabaseAdmin()
    .from("subscriptions")
    .upsert(
      { org_id: ctx.orgId, stripe_customer_id: customer.id },
      { onConflict: "org_id" }
    );
  return customer.id;
}

/** Resolve the configured Stripe Price ID for a self-serve tier, or throw. */
function priceIdForTier(tier: ReturnType<typeof tierByKey>): string {
  if (isContactSales(tier)) throw new Error("This tier is contact-sales.");
  const priceId = tier.priceEnvKey ? process.env[tier.priceEnvKey] : undefined;
  if (!priceId) {
    throw new Error(`Missing Stripe price for ${tier.label} (${tier.priceEnvKey}).`);
  }
  return priceId;
}

/**
 * Start a subscription for a tier and return the client secret for collecting a
 * card in-app with a card-only Stripe Elements form (no Checkout, no Link/bank).
 *
 * Created with `payment_behavior: "default_incomplete"` so the subscription begins
 * in `trialing` immediately (everyone gets a free trial — longer for referred
 * orgs) with a `pending_setup_intent` we confirm client-side via `confirmCardSetup`.
 * `save_default_payment_method: "on_subscription"` makes the collected card the
 * default for renewals and off-session top-ups. Access is provisioned by the
 * `customer.subscription.created` webhook, never here.
 */
export async function createSubscription(
  tierKey: TierKey
): Promise<{ clientSecret: string }> {
  await requireAdmin();
  if (!hasStripe()) throw new Error("Billing is not configured.");
  if (!isTierKey(tierKey)) throw new Error("Unknown tier.");
  const tier = tierByKey(tierKey);
  const priceId = priceIdForTier(tier);

  const ctx = await loadOrgContext();
  const customerId = await ensureCustomer(ctx);
  const trialDays = ctx.referredByOrg ? 60 : 30;

  const stripe = getStripe();
  const sub = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: trialDays,
    payment_behavior: "default_incomplete",
    payment_settings: {
      save_default_payment_method: "on_subscription",
      payment_method_types: ["card"],
    },
    trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    metadata: { org_id: ctx.orgId, tier: tier.key },
    expand: ["pending_setup_intent"],
  });

  const psi = sub.pending_setup_intent;
  const clientSecret =
    psi && typeof psi !== "string" ? psi.client_secret : null;
  if (!clientSecret) {
    throw new Error("Stripe did not return a setup client secret.");
  }
  return { clientSecret };
}

/**
 * Switch an existing subscription to a different tier by swapping the price on
 * its single item, prorating the change. Updates `metadata.tier` too: the webhook
 * prefers subscription metadata over the price-derived tier, so a stale value
 * there would re-sync the old tier. The `customer.subscription.updated` webhook
 * persists the new tier, well cap, and credit allotment.
 */
export async function changeSubscriptionTier(
  tierKey: TierKey
): Promise<{ ok: true }> {
  await requireAdmin();
  if (!hasStripe()) throw new Error("Billing is not configured.");
  if (!isTierKey(tierKey)) throw new Error("Unknown tier.");
  const tier = tierByKey(tierKey);
  const priceId = priceIdForTier(tier);

  const ctx = await loadOrgContext();
  const subId = await currentSubscriptionId(ctx.orgId);
  if (!subId) {
    throw new Error("No active subscription to change. Subscribe to a plan first.");
  }

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subId);
  const itemId = sub.items.data[0]?.id;
  if (!itemId) throw new Error("Subscription has no billable item to update.");

  await stripe.subscriptions.update(subId, {
    items: [{ id: itemId, price: priceId }],
    cancel_at_period_end: false,
    proration_behavior: "create_prorations",
    metadata: { org_id: ctx.orgId, tier: tier.key },
  });
  return { ok: true };
}

/**
 * Schedule cancellation at the end of the paid period (the org keeps access until
 * then). The `customer.subscription.updated` webhook mirrors `cancel_at_period_end`.
 */
export async function cancelSubscription(): Promise<{ ok: true }> {
  await requireAdmin();
  if (!hasStripe()) throw new Error("Billing is not configured.");
  const ctx = await loadOrgContext();
  const subId = await currentSubscriptionId(ctx.orgId);
  if (!subId) throw new Error("No active subscription to cancel.");
  await getStripe().subscriptions.update(subId, { cancel_at_period_end: true });
  return { ok: true };
}

/** Undo a scheduled cancellation, keeping the subscription active. */
export async function resumeSubscription(): Promise<{ ok: true }> {
  await requireAdmin();
  if (!hasStripe()) throw new Error("Billing is not configured.");
  const ctx = await loadOrgContext();
  const subId = await currentSubscriptionId(ctx.orgId);
  if (!subId) throw new Error("No subscription to resume.");
  await getStripe().subscriptions.update(subId, { cancel_at_period_end: false });
  return { ok: true };
}

/** Open the Stripe customer portal for self-serve plan/payment management. */
export async function startCustomerPortal(): Promise<{ url: string }> {
  await requireAdmin();
  if (!hasStripe()) throw new Error("Billing is not configured.");
  const ctx = await loadOrgContext();
  const customerId = await ensureCustomer(ctx);

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getAppUrl()}/settings?section=billing`,
  });
  return { url: session.url };
}

/**
 * Create a SetupIntent to save a card on file, collected in-app with a card-only
 * Stripe Elements form (no Link/wallets — see CardForm). Returns the client
 * secret for the browser's <Elements> + PaymentElement. On success the card is
 * attached to the customer and the `setup_intent.succeeded` webhook marks it the
 * default, so later credit top-ups can charge it off-session.
 *
 * We use a raw SetupIntent rather than a Checkout Session here because embedded
 * Checkout always surfaces Link when it's enabled on the account; Elements lets us
 * restrict the form to cards (`payment_method_types: ["card"]` + wallets off).
 */
export async function createCardSetupIntent(): Promise<{
  clientSecret: string;
}> {
  await requireAdmin();
  if (!hasStripe()) throw new Error("Billing is not connected yet.");
  const ctx = await loadOrgContext();
  const customerId = await ensureCustomer(ctx);

  const stripe = getStripe();
  const intent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session",
    metadata: { org_id: ctx.orgId, kind: "save_card" },
  });
  if (!intent.client_secret) {
    throw new Error("Stripe did not return a setup client secret.");
  }
  return { clientSecret: intent.client_secret };
}

/** The org's default card payment method id, or null if none on file. */
async function defaultPaymentMethodId(customerId: string): Promise<string | null> {
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer.deleted) {
    const def = customer.invoice_settings?.default_payment_method;
    if (def) return typeof def === "string" ? def : def.id;
  }
  const pms = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });
  return pms.data[0]?.id ?? null;
}

/** List the org's saved cards for client UIs (e.g. the buy-credits modal). */
export async function listPaymentMethods(): Promise<PaymentMethodInfo[]> {
  return getPaymentMethods();
}

/**
 * Buy an AI-credit top-up for `usd` dollars by charging a card on file
 * off-session. When `paymentMethodId` is given, that card is charged (after
 * verifying it belongs to the org); otherwise the default card is used. Credits
 * are granted by the webhook on `payment_intent.succeeded`. Returns nothing to
 * redirect to — the charge happens server-side.
 */
export async function chargeTopUp(
  usd: number,
  paymentMethodId?: string
): Promise<{ ok: true }> {
  await requireAdmin();
  if (!hasStripe()) throw new Error("Billing is not connected yet.");
  const amount = Math.round(usd);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a positive amount.");
  }

  const ctx = await loadOrgContext();
  const customerId = await ensureCustomer(ctx);
  const stripe = getStripe();

  let paymentMethod = paymentMethodId ?? null;
  if (paymentMethod) {
    // Verify the chosen card belongs to this org's customer before charging.
    const pm = await stripe.paymentMethods.retrieve(paymentMethod);
    const owner = typeof pm.customer === "string" ? pm.customer : pm.customer?.id;
    if (owner !== customerId) {
      throw new Error("That payment method does not belong to your organization.");
    }
  } else {
    paymentMethod = await defaultPaymentMethodId(customerId);
  }
  if (!paymentMethod) {
    throw new Error("No card on file. Add a payment method on the Billing tab.");
  }

  const credits = dollarsToTopUpCredits(amount);
  try {
    await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethod,
      off_session: true,
      confirm: true,
      metadata: { org_id: ctx.orgId, kind: "topup", credits: String(credits) },
    });
  } catch {
    throw new Error(
      "We couldn't charge your card on file. Update your payment method on the Billing tab."
    );
  }
  return { ok: true };
}

/** Verify a payment method belongs to the caller's org, returning the Stripe client. */
async function assertOwnsPaymentMethod(paymentMethodId: string) {
  await requireAdmin();
  if (!hasStripe()) throw new Error("Billing is not connected yet.");
  const ctx = await loadOrgContext();
  if (!ctx.stripeCustomerId) throw new Error("No customer on file.");
  const stripe = getStripe();
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  const owner = typeof pm.customer === "string" ? pm.customer : pm.customer?.id;
  if (owner !== ctx.stripeCustomerId) {
    throw new Error("That payment method does not belong to your organization.");
  }
  return { stripe, customerId: ctx.stripeCustomerId };
}

/** Make a saved card the default for the subscription and off-session top-ups. */
export async function setDefaultPaymentMethod(
  paymentMethodId: string
): Promise<{ ok: true }> {
  const { stripe, customerId } = await assertOwnsPaymentMethod(paymentMethodId);
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
  return { ok: true };
}

/** Update the editable details of a saved card (name + expiry). */
export async function updatePaymentMethod(
  paymentMethodId: string,
  details: { name?: string; expMonth?: number; expYear?: number }
): Promise<{ ok: true }> {
  const { stripe } = await assertOwnsPaymentMethod(paymentMethodId);
  await stripe.paymentMethods.update(paymentMethodId, {
    ...(details.name !== undefined
      ? { billing_details: { name: details.name } }
      : {}),
    ...(details.expMonth && details.expYear
      ? { card: { exp_month: details.expMonth, exp_year: details.expYear } }
      : {}),
  });
  return { ok: true };
}

/** Remove (detach) a saved card from the org's customer. */
export async function removePaymentMethod(
  paymentMethodId: string
): Promise<{ ok: true }> {
  const { stripe } = await assertOwnsPaymentMethod(paymentMethodId);
  await stripe.paymentMethods.detach(paymentMethodId);
  return { ok: true };
}

/** All tiers for the UI, including the contact-sales (Enterprise) tier. */
export async function listTiers() {
  return TIERS.map((t) => ({
    key: t.key,
    label: t.label,
    monthlyUsd: t.monthlyUsd,
    wellCap: t.wellCap,
    monthlyCredits: t.monthlyCredits,
    contactSales: isContactSales(t),
  }));
}
