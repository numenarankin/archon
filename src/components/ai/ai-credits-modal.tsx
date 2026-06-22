"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import { chargeTopUp, listPaymentMethods } from "@/lib/billing/actions";
import type { PaymentMethodInfo } from "@/lib/billing/payment-methods";

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function cardLabel(pm: PaymentMethodInfo): string {
  return `${titleCase(pm.brand)} •••• ${pm.last4}`;
}

interface AiCreditsModalProps {
  open: boolean;
  onClose: () => void;
}

export function AiCreditsModal({ open, onClose }: AiCreditsModalProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loadingCards, setLoadingCards] = useState(false);
  const [methods, setMethods] = useState<PaymentMethodInfo[]>([]);
  const [methodId, setMethodId] = useState<string>("");
  const [amount, setAmount] = useState("50");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Lazily load the org's cards when the modal opens (avoids a Stripe round-trip
  // on every page that renders the header).
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingCards(true);
    setError(null);
    setDone(false);
    listPaymentMethods()
      .then((list) => {
        if (!active) return;
        setMethods(list);
        const preferred = list.find((m) => m.isDefault) ?? list[0];
        setMethodId(preferred?.id ?? "");
      })
      .catch(() => {
        if (active) setError("Couldn't load your payment methods.");
      })
      .finally(() => {
        if (active) setLoadingCards(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const usd = Number(amount);
  const canBuy =
    !pending && Number.isFinite(usd) && usd > 0 && methodId.length > 0;

  function buy() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      try {
        await chargeTopUp(usd, methodId);
        setDone(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <SwipeUpModal
      open={open}
      onClose={onClose}
      title="Buy AI credits"
      description="Charge a card on file to top up your balance."
    >
      <div className="flex flex-col gap-4 px-5 py-5">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {done && (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Payment received. Your credits will update in a moment.
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Amount to spend
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              className="h-10 pl-7 font-mono"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="50"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Payment method
          </span>
          <Select
            value={methodId}
            onValueChange={(v) => setMethodId(v ?? "")}
            disabled={loadingCards || methods.length === 0}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue
                placeholder={
                  loadingCards
                    ? "Loading cards…"
                    : methods.length === 0
                      ? "No cards on file"
                      : "Select a card"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {methods.map((pm) => (
                <SelectItem key={pm.id} value={pm.id}>
                  {cardLabel(pm)}
                  {pm.isDefault ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!loadingCards && methods.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Add a card on the Billing tab to buy credits.
            </span>
          )}
        </label>

        <div className="mt-2 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="button" size="lg" disabled={!canBuy} onClick={buy}>
            {pending && <Loader2Icon className="size-4 animate-spin" />}
            Buy ${Number.isFinite(usd) ? usd.toLocaleString() : "0"}
          </Button>
        </div>
      </div>
    </SwipeUpModal>
  );
}
