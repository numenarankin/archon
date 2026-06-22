"use client";

import { useEffect, useState } from "react";
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

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Current local date (`YYYY-MM-DD`) and time (`HH:MM`). */
function nowParts(): { date: string; time: string } {
  const now = new Date();
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

type FormState = { date: string; time: string } & Record<NumericKey, string>;

const emptyNumbers = {
  oilProduction: "",
  oilStock: "",
  oilSales: "",
  gasProduction: "",
  saltWater: "",
};

export function AddDataModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (point: ProductionPoint) => void;
}) {
  const [form, setForm] = useState<FormState>({
    date: "",
    time: "",
    ...emptyNumbers,
  });

  // Reset the form to the current date/time whenever the modal opens.
  useEffect(() => {
    if (open) {
      setForm({ ...nowParts(), ...emptyNumbers });
    }
  }, [open]);

  function handleField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const toNumber = (value: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    onSubmit({
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

  return (
    <SwipeUpModal
      open={open}
      onClose={onClose}
      title="Add Production Data"
      description="Record a new daily reading for this well."
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Date</span>
              <Input
                type="date"
                className="h-11"
                value={form.date}
                onChange={(e) => handleField("date", e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Time</span>
              <Input
                type="time"
                className="h-11"
                value={form.time}
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
                  value={form[field.key]}
                  onChange={(e) => handleField(field.key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg">
            Add Data
          </Button>
        </div>
      </form>
    </SwipeUpModal>
  );
}
