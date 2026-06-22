"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveOnboardingDetails } from "@/app/onboarding/actions";
import { isTierKey, type TierKey } from "@/lib/billing/tiers";
import { PlanStep, type OnboardingTier } from "@/components/onboarding/plan-step";
import { PaymentStep } from "@/components/onboarding/payment-step";
import { InviteTeamStep } from "@/components/onboarding/invite-team-step";

type Step = "details" | "plan" | "payment" | "done";

/** The plan grid needs room to breathe; the other steps read better narrow. */
const STEP_WIDTH: Record<Step, string> = {
  details: "max-w-lg",
  plan: "max-w-4xl",
  payment: "max-w-md",
  done: "max-w-lg",
};

interface OnboardingFlowProps {
  /** Company name carried over from the org (usually the default placeholder). */
  companyName: string;
  companyAddress: string | null;
  employeeCount: number | null;
  wellCount: number | null;
  /** Recommended tier, set once details are saved (null on a fresh org). */
  recommendedTier: string | null;
  /** All tiers for the plan grid, including contact-sales. */
  tiers: OnboardingTier[];
  /** Whether Stripe is wired up; drives whether we can take a card here. */
  stripeConfigured: boolean;
  /** Whether the org already started a subscription (resume past plan/payment). */
  hasSubscription: boolean;
  /** Whether onboarding is already finalized (resume on the optional last step). */
  alreadyOnboarded: boolean;
}

/**
 * Admin onboarding. Four steps: company details, plan selection, payment, then
 * an optional "invite your team" hand-off into the workspace. Onboarding is
 * finalized (which lifts the proxy gate) only on the final hand-off, so this
 * route never flips to "completed" mid-flow and bounces the owner home while the
 * invite UI is still on screen. Resumes at the right step on reload.
 */
export function OnboardingFlow({
  companyName,
  companyAddress,
  employeeCount,
  wellCount,
  recommendedTier,
  tiers,
  stripeConfigured,
  hasSubscription,
  alreadyOnboarded,
}: OnboardingFlowProps) {
  const detailsSaved = Boolean(companyAddress && wellCount && recommendedTier);
  // Resume where they left off: a finalized or subscribed org has only the
  // optional invite hand-off left; saved details means the plan step; otherwise
  // the top.
  const initialStep: Step =
    alreadyOnboarded || hasSubscription
      ? "done"
      : detailsSaved
        ? "plan"
        : "details";
  const [step, setStep] = useState<Step>(initialStep);
  const [name, setName] = useState(
    companyName && companyName !== "My Workspace" ? companyName : ""
  );
  const [address, setAddress] = useState(companyAddress ?? "");
  const [employees, setEmployees] = useState(
    employeeCount ? String(employeeCount) : ""
  );
  const [wells, setWells] = useState(wellCount ? String(wellCount) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommended, setRecommended] = useState<TierKey | null>(
    isTierKey(recommendedTier) ? recommendedTier : null
  );
  // Tier carried from the plan step into the payment step.
  const [payingTier, setPayingTier] = useState<TierKey | null>(null);

  const payingTierOption = payingTier
    ? tiers.find((t) => t.key === payingTier) ?? null
    : null;

  async function handleDetails(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await saveOnboardingDetails({
        companyName: name,
        companyAddress: address,
        employeeCount: Number(employees) || 0,
        wellCount: Number(wells) || 0,
      });
      setRecommended(isTierKey(result.recommendedTier) ? result.recommendedTier : null);
      setStep("plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "mx-auto flex min-h-screen flex-col justify-center px-6 py-12",
        STEP_WIDTH[step]
      )}
    >
      {step === "details" && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Set up your workspace
            </h1>
            <p className="text-muted-foreground">
              Tell us about your company so we can recommend the right plan.
            </p>
          </div>

          <form onSubmit={handleDetails} className="space-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Company name</span>
              <Input
                required
                autoFocus
                className="h-11"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Energy"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Company address</span>
              <Input
                required
                className="h-11"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, Midland, TX"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Employees</span>
                <Input
                  type="number"
                  min={0}
                  className="h-11"
                  value={employees}
                  onChange={(e) => setEmployees(e.target.value)}
                  placeholder="25"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Wells</span>
                <Input
                  type="number"
                  min={1}
                  required
                  className="h-11"
                  value={wells}
                  onChange={(e) => setWells(e.target.value)}
                  placeholder="40"
                />
              </label>
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading && (
                <Loader2Icon data-icon="inline-start" className="animate-spin" />
              )}
              Continue
            </Button>
          </form>
        </div>
      )}

      {step === "plan" && (
        <PlanStep
          tiers={tiers}
          recommended={recommended}
          stripeConfigured={stripeConfigured}
          onContinueToPayment={(tierKey) => {
            setPayingTier(tierKey);
            setStep("payment");
          }}
          onComplete={() => setStep("done")}
        />
      )}

      {step === "payment" && payingTierOption && (
        <PaymentStep
          tier={payingTierOption}
          onBack={() => setStep("plan")}
          onComplete={() => setStep("done")}
        />
      )}

      {step === "done" && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">You&apos;re all set</h1>
            <p className="text-muted-foreground">
              Your workspace is ready. Invite your team now, or jump straight in.
            </p>
          </div>

          <InviteTeamStep />

          <Link href="/" className={buttonVariants({ className: "h-11 w-full" })}>
            Continue to your workspace
          </Link>
        </div>
      )}
    </div>
  );
}
