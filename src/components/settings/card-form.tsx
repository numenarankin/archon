"use client";

import { useState } from "react";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { Loader2Icon, LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStripeBrowser } from "@/lib/billing/stripe-browser";

/**
 * Card-only payment form. Uses Stripe's dedicated CardElement (card number /
 * expiry / CVC / postal) — NOT the PaymentElement or Checkout, both of which
 * surface Link and bank options when those are enabled on the account. CardElement
 * can only ever collect a card.
 *
 * Both saving a card and starting a subscription resolve to a Stripe SetupIntent
 * (the subscription's `pending_setup_intent`), so the same component confirms both
 * via `confirmCardSetup`. The intent is created lazily on submit, so abandoning the
 * form creates nothing; on failure the same client secret is reused for retries.
 */
interface CardFormProps {
  /** Server action that creates the intent/subscription and returns its client secret. */
  createIntent: () => Promise<{ clientSecret: string }>;
  submitLabel: string;
  /** Called after the card is confirmed (close the modal + refresh). */
  onDone: () => void;
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: "16px",
      color: "#171717",
      "::placeholder": { color: "#9ca3af" },
    },
    invalid: { color: "#dc2626" },
  },
} as const;

function CardFields({ createIntent, submitLabel, onDone }: CardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  async function submit() {
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) return;

    setError(null);
    setBusy(true);

    // Create the intent only on the first submit; reuse it for retries.
    let secret = clientSecret;
    if (!secret) {
      try {
        secret = (await createIntent()).clientSecret;
        setClientSecret(secret);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't start checkout.");
        setBusy(false);
        return;
      }
    }

    const { error: confirmError } = await stripe.confirmCardSetup(secret, {
      payment_method: { card },
    });
    if (confirmError) {
      setError(confirmError.message ?? "We couldn't save that card.");
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="rounded-lg border border-border bg-background px-3.5 py-3.5">
        <CardElement
          options={CARD_ELEMENT_OPTIONS}
          onReady={() => setReady(true)}
        />
      </div>
      <Button
        size="lg"
        className="h-11 w-full text-sm"
        disabled={!stripe || !ready || busy}
        onClick={submit}
      >
        {busy ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <LockIcon className="size-4" />
        )}
        {submitLabel}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Saved securely with Stripe.
      </p>
    </div>
  );
}

export function CardForm(props: CardFormProps) {
  const [stripe] = useState(getStripeBrowser);
  return (
    <Elements stripe={stripe}>
      <CardFields {...props} />
    </Elements>
  );
}
