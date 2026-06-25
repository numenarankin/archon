"use client";

import { useEffect, useState } from "react";
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
import {
  PIPELINE_STAGES,
  DEAL_OWNERS,
  UNOWNED,
  type Deal,
  type DealStage,
} from "@/lib/numena/pipeline";

export type NewDeal = Omit<Deal, "id">;

/** Keep only number-ish input (digits + a single dot) for amount fields. */
function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, "")
  );
}

/** Clamp a probability string to 0–100. */
function clampProbability(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits === "") return "";
  return String(Math.min(100, Number(digits)));
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

interface DealModalProps {
  open: boolean;
  /** "add" creates a new deal; "edit" updates an existing one. */
  mode: "add" | "edit";
  onClose: () => void;
  onSubmit: (deal: NewDeal) => void;
  /** Existing deal to seed the form from in "edit" mode. */
  deal?: Deal | null;
  /** Default stage for a newly added deal. */
  defaultStage?: DealStage;
}

/**
 * Shared create/edit deal modal. Edits live in local state and only propagate
 * to the board on Add Deal / Save — closing or cancelling discards them.
 */
export function DealModal({
  open,
  mode,
  onClose,
  onSubmit,
  deal,
  defaultStage = "lead",
}: DealModalProps) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState<DealStage>(defaultStage);
  const [owner, setOwner] = useState<string>(UNOWNED);
  const [closeDate, setCloseDate] = useState("");
  const [probability, setProbability] = useState("");
  const [note, setNote] = useState("");

  // Seed the form each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setName(deal?.name ?? "");
    setCompany(deal?.company ?? "");
    setValue(deal?.value != null ? String(deal.value) : "");
    setStage(deal?.stage ?? defaultStage);
    setOwner(deal?.owner ?? UNOWNED);
    setCloseDate(deal?.closeDate ?? "");
    setProbability(deal?.probability != null ? String(deal.probability) : "");
    setNote(deal?.note ?? "");
  }, [open, deal, defaultStage]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const valueNum = value.trim() === "" ? 0 : Number(value);
    const probNum = probability.trim() === "" ? undefined : Number(probability);
    onSubmit({
      name: trimmedName,
      company: company.trim(),
      value: Number.isNaN(valueNum) ? 0 : valueNum,
      stage,
      owner: owner === UNOWNED ? undefined : owner,
      closeDate: closeDate || undefined,
      probability: probNum != null && !Number.isNaN(probNum) ? probNum : undefined,
      note: note.trim() || undefined,
    });
    onClose();
  }

  const isEdit = mode === "edit";

  return (
    <SwipeUpModal
      open={open}
      onClose={onClose}
      title={isEdit ? "Deal" : "Add Deal"}
      description={
        isEdit
          ? "Make changes, then click Save to apply them."
          : "Fill in the details, then choose a stage."
      }
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-5">
          <Field label="Deal name">
            <Input
              className="h-11"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What's the opportunity?"
            />
          </Field>

          <Field label="Company">
            <Input
              className="h-11"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Account name"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Value (USD)">
              <Input
                className="h-11"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(sanitizeAmount(e.target.value))}
                placeholder="$ deal size"
              />
            </Field>

            <Field label="Probability (%)">
              <Input
                className="h-11"
                inputMode="numeric"
                value={probability}
                onChange={(e) => setProbability(clampProbability(e.target.value))}
                placeholder="0–100"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Stage</span>
              <Select
                value={stage}
                onValueChange={(v) => setStage((v ?? "lead") as DealStage)}
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s.stage} value={s.stage}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Owner</span>
              <Select
                value={owner}
                onValueChange={(v) => setOwner(v ?? UNOWNED)}
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNOWNED}>{UNOWNED}</SelectItem>
                  {DEAL_OWNERS.map((person) => (
                    <SelectItem key={person} value={person}>
                      {person}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Field label="Expected close">
            <Input
              type="date"
              className="h-11"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
            />
          </Field>

          <Field label="Note">
            <textarea
              className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Context, next steps…"
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg">
            {isEdit ? "Save" : "Add Deal"}
          </Button>
        </div>
      </form>
    </SwipeUpModal>
  );
}
