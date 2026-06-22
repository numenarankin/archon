"use client";

import { useState, useTransition } from "react";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { finalizeOnboarding } from "@/app/onboarding/actions";
import { type TierKey } from "@/lib/billing/tiers";

/** Where "Talk to sales" should go. Mirrors the Settings billing section. */
const SALES_MAILTO = "mailto:sales@example.com?subject=Enterprise%20plan";

/** Tier shape passed from the server (see `listTiers`). */
export interface OnboardingTier {
  key: TierKey;
  label: string;
  monthlyUsd: number | null;
  wellCap: number;
  monthlyCredits: number;
  contactSales: boolean;
}

interface PlanStepProps {
  tiers: OnboardingTier[];
  /** Tier recommended from the well count; pre-selected and badged. */
  recommended: TierKey | null;
  /** Whether Stripe is wired up. When false we can't take a card. */
  stripeConfigured: boolean;
  /** Advance to the payment step for a self-serve tier. */
  onContinueToPayment: (tierKey: TierKey) => void;
  /** Finalize done (used by the contact-sales / Stripe-off paths). */
  onComplete: () => void;
}

/**
 * Subscription selection step. The owner picks a plan (any self-serve tier; the
 * recommendation is pre-selected). Continuing a self-serve plan hands off to the
 * payment step. Contact-sales (tier 5) and the Stripe-not-configured case can't
 * collect a card here, so they finalize onboarding and continue straight in.
 */
export function PlanStep({
  tiers,
  recommended,
  stripeConfigured,
  onContinueToPayment,
  onComplete,
}: PlanStepProps) {
  const [selected, setSelected] = useState<TierKey | null>(recommended);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedTier = selected
    ? tiers.find((t) => t.key === selected) ?? null
    : null;
  const selfServeSelected = Boolean(selectedTier && !selectedTier.contactSales);
  const takesCard = stripeConfigured && selfServeSelected;

  /** Nothing to pay (contact-sales or billing off): commit onboarding + continue. */
  function finishWithoutPayment() {
    setError(null);
    startTransition(async () => {
      try {
        await finalizeOnboarding();
        onComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleContinue() {
    if (!selected) return;
    // Self-serve tiers collect a card next, which finalizes onboarding there.
    if (takesCard) {
      onContinueToPayment(selected);
    } else {
      finishWithoutPayment();
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Choose your plan</h1>
        <p className="text-muted-foreground">
          Based on your well count we suggest the highlighted plan. You can
          change it anytime. You won&apos;t be charged during your free trial.
        </p>
      </div>

      {!stripeConfigured && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Billing isn&apos;t connected yet, so you can finish setup now and add a
          plan later from Settings.
        </div>
      )}

      <div className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier) => {
          const isSelected = selected === tier.key;
          const isRecommended = recommended === tier.key;
          return (
            <button
              type="button"
              key={tier.key}
              aria-pressed={isSelected}
              onClick={() => {
                setError(null);
                setSelected(tier.key);
              }}
              className={cn(
                "group relative flex flex-col gap-4 rounded-2xl border bg-card p-5 text-left transition",
                isSelected
                  ? "border-foreground/40 shadow-sm ring-1 ring-foreground/20"
                  : "border-border hover:border-foreground/30 hover:shadow-sm"
              )}
            >
              {isRecommended && (
                <span className="absolute -top-2.5 left-5 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  Recommended
                </span>
              )}

              <div className="flex items-start justify-between gap-2">
                <span className="text-base font-semibold">{tier.label}</span>
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border transition",
                    isSelected
                      ? "border-foreground/40 bg-foreground/70 text-background"
                      : "border-muted-foreground/40 group-hover:border-foreground/60"
                  )}
                >
                  {isSelected && <CheckIcon className="size-3.5" />}
                </span>
              </div>

              <div>
                <span className="text-2xl font-semibold tracking-tight">
                  {tier.contactSales
                    ? "Custom"
                    : `$${tier.monthlyUsd?.toLocaleString()}`}
                </span>
                {!tier.contactSales && (
                  <span className="text-sm text-muted-foreground"> /mo</span>
                )}
              </div>

              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckIcon className="size-4 shrink-0 text-primary" />
                  {tier.contactSales
                    ? "Unlimited wells"
                    : `Up to ${tier.wellCap.toLocaleString()} wells`}
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="size-4 shrink-0 text-primary" />
                  {tier.monthlyCredits.toLocaleString()} AI credits / mo
                </li>
              </ul>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:max-w-sm">
        {selectedTier?.contactSales ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={SALES_MAILTO}
              className={cn(buttonVariants(), "h-11 flex-1 text-sm")}
            >
              Talk to sales
            </a>
            <Button
              variant="outline"
              className="h-11 flex-1 text-sm"
              disabled={pending}
              onClick={finishWithoutPayment}
            >
              {pending && <Loader2Icon className="size-4 animate-spin" />}
              Continue
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            className="h-11 w-full text-sm"
            disabled={!selected || pending}
            onClick={handleContinue}
          >
            {pending && <Loader2Icon className="size-4 animate-spin" />}
            {takesCard ? "Continue to payment" : "Continue"}
          </Button>
        )}
      </div>
    </div>
  );
}
