"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createCardSetupIntent } from "@/lib/billing/actions";
import { PaymentMethodModal } from "@/components/settings/payment-method-modal";
import { CardForm } from "@/components/settings/card-form";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import type { PaymentMethodInfo } from "@/lib/billing/payment-methods";

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface PaymentMethodsSectionProps {
  methods: PaymentMethodInfo[];
  stripeConfigured: boolean;
}

export function PaymentMethodsSection({
  methods,
  stripeConfigured,
}: PaymentMethodsSectionProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PaymentMethodInfo | null>(null);
  const [addingCard, setAddingCard] = useState(false);

  function addCard() {
    setError(null);
    if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      setError("Stripe publishable key isn't configured yet.");
      return;
    }
    setAddingCard(true);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header line: title left, add action right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Payment methods
        </h2>
        <Button size="lg" onClick={addCard}>
          <PlusIcon />
          Add card
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-[0.1rem] border">
        <Table className="text-[0.95rem]">
          <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Card</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Default</TableHead>
              <TableHead className="text-right">Settings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {methods.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  {stripeConfigured
                    ? "No cards on file yet. Add one to get started."
                    : "Connect Stripe to add a card on file."}
                </TableCell>
              </TableRow>
            ) : (
              methods.map((pm) => (
                <TableRow key={pm.id} className="[&>td]:py-4">
                  <TableCell className="font-medium">
                    {titleCase(pm.brand)} •••• {pm.last4}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {pm.name || "Not set"}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {String(pm.expMonth).padStart(2, "0")}/{pm.expYear}
                  </TableCell>
                  <TableCell>
                    {pm.isDefault ? (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Default
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">No</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${titleCase(pm.brand)} ending ${pm.last4}`}
                        onClick={() => setEditing(pm)}
                      >
                        <SettingsIcon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaymentMethodModal
        method={editing}
        onClose={() => setEditing(null)}
        onSaved={() => router.refresh()}
      />

      {/* Card-only setup form (SetupIntent + Elements) */}
      <SwipeUpModal
        open={addingCard}
        onClose={() => setAddingCard(false)}
        title="Add a card"
        description="Used for your subscription and credit top-ups."
        className="max-w-md"
      >
        {addingCard && (
          <div className="px-5 py-5">
            <CardForm
              createIntent={createCardSetupIntent}
              submitLabel="Save card"
              onDone={() => {
                setAddingCard(false);
                router.refresh();
              }}
            />
          </div>
        )}
      </SwipeUpModal>
    </div>
  );
}
