"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";

export interface WellInfo {
  name: string;
  formation: string;
  /** County the surface location sits in. */
  county: string;
  /** Total measured depth, in feet. */
  depth: number;
  /** Perforation interval, e.g. "9,800–11,120". */
  perforations: string;
  /** ISO date string (YYYY-MM-DD), or "" if unknown. */
  dateDrilled: string;
  /** Surface-location coordinates, free-form (e.g. "31.9686, -102.0779"). */
  coordinates: string;
  /**
   * Barrels of oil per inch of tank gauge. Oil readings are entered in gauge
   * inches and displayed as barrels using this ratio. Defaults to 1.
   */
  oilBblPerInch: number;
}

interface WellInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  info: WellInfo;
  onSave: (info: WellInfo) => void;
  /** Dialog heading. Defaults to "Well info". */
  title?: string;
  /** Submit button label. Defaults to "Save". */
  submitLabel?: string;
}

export function WellInfoDialog({
  open,
  onOpenChange,
  info,
  onSave,
  title = "Well info",
  submitLabel = "Save",
}: WellInfoDialogProps) {
  const [draft, setDraft] = useState<WellInfo>(info);
  // Oil bbl/in is kept as raw text while editing so decimals (e.g. "1.5") type
  // smoothly; it's parsed back to a number in `draft` on each change.
  const [oilInput, setOilInput] = useState(String(info.oilBblPerInch));

  // Re-seed the form from the latest info whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setDraft(info);
      setOilInput(String(info.oilBblPerInch));
    }
  }, [open, info]);

  function handleOilChange(raw: string) {
    setOilInput(raw);
    const parsed = raw.trim() === "" ? 1 : Number(raw);
    if (Number.isFinite(parsed)) {
      setDraft((d) => ({ ...d, oilBblPerInch: parsed }));
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSave({ ...draft, name: draft.name.trim() || info.name });
    onOpenChange(false);
  }

  return (
    <SwipeUpModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name">
              <Input
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
              />
            </Field>
            <Field label="Formation">
              <Input
                value={draft.formation}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, formation: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="County">
              <Input
                value={draft.county}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, county: e.target.value }))
                }
              />
            </Field>
            <Field label="Depth (ft)">
              <Input
                type="number"
                value={Number.isFinite(draft.depth) ? draft.depth : ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    depth: e.target.value === "" ? 0 : Number(e.target.value),
                  }))
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Perforations">
              <Input
                value={draft.perforations}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, perforations: e.target.value }))
                }
              />
            </Field>
            <Field label="Date drilled">
              <Input
                type="date"
                value={draft.dateDrilled}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, dateDrilled: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Coordinates">
              <Input
                value={draft.coordinates}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, coordinates: e.target.value }))
                }
              />
            </Field>
            <Field label="Oil bbl/in">
              <Input
                inputMode="decimal"
                placeholder="1"
                value={oilInput}
                onChange={(e) => handleOilChange(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={!draft.name.trim()}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </SwipeUpModal>
  );
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
      <span className="ty-body-2 font-medium text-primary-text">{label}</span>
      {children}
    </label>
  );
}
