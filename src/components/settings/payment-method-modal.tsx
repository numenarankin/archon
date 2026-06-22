"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import {
  removePaymentMethod,
  setDefaultPaymentMethod,
  updatePaymentMethod,
} from "@/lib/billing/actions";
import type { PaymentMethodInfo } from "@/lib/billing/payment-methods";

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface PaymentMethodModalProps {
  method: PaymentMethodInfo | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PaymentMethodModal({
  method,
  onClose,
  onSaved,
}: PaymentMethodModalProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(method?.name ?? "");
  const [expMonth, setExpMonth] = useState(String(method?.expMonth ?? ""));
  const [expYear, setExpYear] = useState(String(method?.expYear ?? ""));
  const [makeDefault, setMakeDefault] = useState(method?.isDefault ?? false);

  if (!method) return null;

  function save() {
    if (!method) return;
    setError(null);
    startTransition(async () => {
      try {
        await updatePaymentMethod(method.id, {
          name,
          expMonth: Number(expMonth) || undefined,
          expYear: Number(expYear) || undefined,
        });
        if (makeDefault && !method.isDefault) {
          await setDefaultPaymentMethod(method.id);
        }
        onSaved();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save the card.");
      }
    });
  }

  function remove() {
    if (!method) return;
    setError(null);
    startTransition(async () => {
      try {
        await removePaymentMethod(method.id);
        onSaved();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't remove the card.");
      }
    });
  }

  return (
    <SwipeUpModal
      open={Boolean(method)}
      onClose={onClose}
      title="Payment method"
      description={`${titleCase(method.brand)} ending in ${method.last4}`}
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Cardholder name
          </span>
          <Input
            className="h-10"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Operator"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Exp. month
            </span>
            <Input
              className="h-10"
              inputMode="numeric"
              value={expMonth}
              onChange={(e) => setExpMonth(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="MM"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Exp. year
            </span>
            <Input
              className="h-10"
              inputMode="numeric"
              value={expYear}
              onChange={(e) => setExpYear(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="YYYY"
            />
          </label>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div>
            <div className="text-sm font-medium">Default payment method</div>
            <div className="text-xs text-muted-foreground">
              Used for the subscription and credit top-ups.
            </div>
          </div>
          <Switch
            checked={makeDefault}
            disabled={method.isDefault}
            onCheckedChange={setMakeDefault}
            aria-label="Set as default payment method"
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={remove}
          >
            <Trash2Icon className="size-4" />
            Remove
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="button" size="lg" disabled={pending} onClick={save}>
              {pending && <Loader2Icon className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </div>
    </SwipeUpModal>
  );
}
