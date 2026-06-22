"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import { cn } from "@/lib/utils";
import type { InventoryItem, InventoryStatus } from "@/lib/inventory/inventory";

const STATUS_OPTIONS: InventoryStatus[] = ["In Stock", "Low", "On Order"];

interface FormState {
  name: string;
  category: string;
  quantity: string;
  unit: string;
  location: string;
  unitCost: string;
  status: InventoryStatus;
  description: string;
}

const emptyForm: FormState = {
  name: "",
  category: "",
  quantity: "",
  unit: "",
  location: "",
  unitCost: "",
  status: "In Stock",
  description: "",
};

function formFromItem(item: InventoryItem): FormState {
  return {
    name: item.name,
    category: item.category,
    quantity: String(item.quantity),
    unit: item.unit,
    location: item.location,
    unitCost: String(item.unitCost),
    status: item.status,
    description: item.description,
  };
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface InventoryModalProps {
  open: boolean;
  /** "add" creates a new item; "edit" updates the supplied one on Save. */
  mode: "add" | "edit";
  onClose: () => void;
  onSubmit: (item: Omit<InventoryItem, "id">) => void;
  /** Existing item to seed the form from in "edit" mode. */
  item?: InventoryItem | null;
}

/**
 * Shared add/edit inventory modal. Edits live in local state and only apply
 * to the table when the user clicks Add Item / Save; cancelling discards them.
 */
export function InventoryModal({
  open,
  mode,
  onClose,
  onSubmit,
  item,
}: InventoryModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);

  // Seed the form each time the modal opens.
  useEffect(() => {
    if (open) {
      setForm(item ? formFromItem(item) : emptyForm);
    }
  }, [open, item]);

  function handleField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({
      name: form.name.trim(),
      category: form.category.trim(),
      quantity: toNumber(form.quantity),
      unit: form.unit.trim(),
      location: form.location.trim(),
      unitCost: toNumber(form.unitCost),
      status: form.status,
      description: form.description.trim(),
    });
    onClose();
  }

  const isEdit = mode === "edit";

  return (
    <SwipeUpModal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Inventory Item" : "Add Inventory Item"}
      description={
        isEdit
          ? "Update any field, then click Save to apply your changes."
          : "Add a new material or part to inventory."
      }
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Item</span>
              <Input
                className="h-11"
                required
                value={form.name}
                onChange={(e) => handleField("name", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Category</span>
              <Input
                className="h-11"
                value={form.category}
                onChange={(e) => handleField("category", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Location</span>
              <Input
                className="h-11"
                value={form.location}
                onChange={(e) => handleField("location", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Quantity</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="0"
                className="h-11"
                value={form.quantity}
                onChange={(e) => handleField("quantity", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Unit</span>
              <Input
                className="h-11"
                placeholder="ea, ft, joint…"
                value={form.unit}
                onChange={(e) => handleField("unit", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Unit Cost (USD)</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="0"
                className="h-11"
                value={form.unitCost}
                onChange={(e) => handleField("unitCost", e.target.value)}
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Status</span>
              <div className="flex h-11 items-center gap-1 rounded-lg bg-muted p-1">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={form.status === option}
                    onClick={() => handleField("status", option)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                      form.status === option &&
                        "bg-background text-foreground shadow-sm hover:text-foreground"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Description</span>
            <textarea
              className="min-h-20 resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.description}
              onChange={(e) => handleField("description", e.target.value)}
              placeholder="Notes, specs, supplier details…"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg">
            {isEdit ? "Save" : "Add Item"}
          </Button>
        </div>
      </form>
    </SwipeUpModal>
  );
}
