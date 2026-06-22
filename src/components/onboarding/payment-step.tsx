"use client";

import { useState, useTransition } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { CardForm } from "@/components/settings/card-form";
import { createSubscription } from "@/lib/billing/actions";
import { finalizeOnboarding } from "@/app/onboarding/actions";
import { type OnboardingTier } from "@/components/onboarding/plan-step";

interface PaymentStepProps {
  /** The self-serve tier chosen on the plan step. */
  tier: OnboardingTier;
  /** Return to plan selection. */
  onBack: () => void;
  /** Subscription started + onboarding finalized; show the optional invite step. */
  onComplete: () => void;
}

/**
 * Payment step. Collects a card with the shared card-only form: confirming it
 * starts a trialing subscription for the chosen tier and saves the card as the
 * default payment method. The backend is finalized here (subscription created,
 * onboarding stamped complete) so everything before the optional invite step is
 * already committed. No charge happens today; the trial bills only when it ends.
 */
export function PaymentStep({ tier, onBack, onComplete }: PaymentStepProps) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  /** Card confirmed: the subscription exists, so commit onboarding + continue. */
  function handlePaid() {
    setError(null);
    startTransition(async () => {
      try {
        await finalizeOnboarding();
        onComplete();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Your card was saved, but we couldn't finish setup. Try again."
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Back to plans
        </button>
        <h1 className="text-2xl font-bold tracking-tight">
          Add your payment method
        </h1>
        <p className="text-muted-foreground">
          Start your{" "}
          <span className="font-medium text-foreground">{tier.label}</span> plan
          for ${tier.monthlyUsd?.toLocaleString()}/mo after your free trial. You
          won&apos;t be charged today.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-5">
        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <CardForm
          createIntent={() => createSubscription(tier.key)}
          submitLabel="Start free trial"
          onDone={handlePaid}
        />
      </div>
    </div>
  );
}
