"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import type { ProductionPoint } from "@/lib/wells/wells";

const NUMERIC_FIELDS = [
  { key: "oilProduction", label: "Oil Prod (in)" },
  { key: "oilStock", label: "Oil Stock (in)" },
  { key: "oilSales", label: "Oil Sales (in)" },
  { key: "gasProduction", label: "Gas (MCF/d)" },
  { key: "saltWater", label: "Salt Water (bbl/d)" },
] as const;

type NumericKey = (typeof NUMERIC_FIELDS)[number]["key"];

type FormState = { date: string; time: string } & Record<NumericKey, string>;

/** Stored barrels → gauge inches for editing (the inverse of the write-time ×). */
function toInches(bbl: number, ratio: number): string {
  const inches = ratio > 0 ? bbl / ratio : bbl;
  return String(Number(inches.toFixed(4)));
}

/**
 * Build the editable form state from a production reading. Oil is stored in
 * barrels but entered/edited as gauge inches, so the oil fields are converted
 * back to inches for display; the save path re-applies the ratio at write time.
 */
function toForm(point: ProductionPoint, ratio: number): FormState {
  return {
    date: point.date,
    time: point.time,
    oilProduction: toInches(point.oilProduction, ratio),
    oilStock: toInches(point.oilStock, ratio),
    oilSales: toInches(point.oilSales, ratio),
    gasProduction: String(point.gasProduction),
    saltWater: String(point.saltWater),
  };
}

export function EditDataModal({
  open,
  point,
  oilBblPerInch,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  /** The reading being edited; null while the modal is closed. */
  point: ProductionPoint | null;
  /** Barrels of oil per gauge inch, for the bbl↔inches edit conversion. */
  oilBblPerInch: number;
  onClose: () => void;
  onSave: (point: ProductionPoint) => void;
  onDelete: (point: ProductionPoint) => void;
}) {
  const [form, setForm] = useState<FormState | null>(null);
  const [synced, setSynced] = useState(false);

  // Load the selected reading into the form when the modal opens — a render-time
  // sync (not an effect) so re-opening always starts from the saved values.
  if (open && point && !synced) {
    setSynced(true);
    setForm(toForm(point, oilBblPerInch));
  } else if (!open && synced) {
    setSynced(false);
  }

  function handleField(key: keyof FormState, value: string) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form || !point) return;
    const toNumber = (value: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    onSave({
      id: point.id,
      date: form.date,
      time: form.time,
      oilProduction: toNumber(form.oilProduction),
      oilStock: toNumber(form.oilStock),
      oilSales: toNumber(form.oilSales),
      gasProduction: toNumber(form.gasProduction),
      saltWater: toNumber(form.saltWater),
    });
    onClose();
  }

  function handleDelete() {
    if (point) onDelete(point);
    onClose();
  }

  return (
    <SwipeUpModal
      open={open}
      onClose={onClose}
      title="Edit Production Data"
      description="Update or remove this daily reading."
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Date</span>
              <Input
                type="date"
                className="h-11"
                value={form?.date ?? ""}
                onChange={(e) => handleField("date", e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Time</span>
              <Input
                type="time"
                className="h-11"
                value={form?.time ?? ""}
                onChange={(e) => handleField("time", e.target.value)}
                required
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {NUMERIC_FIELDS.map((field) => (
              <label key={field.key} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{field.label}</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder="0"
                  className="h-11"
                  value={form?.[field.key] ?? ""}
                  onChange={(e) => handleField(field.key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-5 py-4">
          <Button
            type="button"
            size="lg"
            onClick={handleDelete}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="lg">
              Save
            </Button>
          </div>
        </div>
      </form>
    </SwipeUpModal>
  );
}
