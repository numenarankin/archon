"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FilterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Active filters applied to the Filings table. */
export interface FilingFilters {
  /** "all" or an exact exemption label, e.g. "506(c)". */
  exemption: string;
  /** "all" or an exact industry label. */
  industry: string;
  /** "" or a yyyy-mm-dd lower bound on filed date (inclusive). */
  dateFrom: string;
  /** "" or a yyyy-mm-dd upper bound on filed date (inclusive). */
  dateTo: string;
}

export const DEFAULT_FILING_FILTERS: FilingFilters = {
  exemption: "all",
  industry: "all",
  dateFrom: "",
  dateTo: "",
};

/** How many filter groups are currently narrowing the results. */
export function activeFilterCount(f: FilingFilters): number {
  let n = 0;
  if (f.exemption !== "all") n += 1;
  if (f.industry !== "all") n += 1;
  if (f.dateFrom || f.dateTo) n += 1;
  return n;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function FilingsFilters({
  exemptions,
  industries,
  value,
  onChange,
}: {
  exemptions: string[];
  industries: string[];
  value: FilingFilters;
  onChange: (next: FilingFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<FilingFilters>) => onChange({ ...value, ...patch });
  const count = activeFilterCount(value);

  // Close on outside click or Escape. The base-ui Select renders its popup in a
  // portal outside this container, so clicks inside it must not count as
  // "outside" — otherwise picking an option would dismiss the whole menu.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (ref.current?.contains(target)) return;
      if (target.closest("[data-slot='select-content']")) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="lg"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <FilterIcon />
        Filters
        {count > 0 && (
          <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
            {count}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 flex w-72 flex-col gap-3 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between">
            <span className="font-heading text-sm font-semibold">
              Filter filings
            </span>
            {count > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onChange(DEFAULT_FILING_FILTERS)}
              >
                Clear
              </Button>
            )}
          </div>

          <Field label="Exemption">
            <Select
              value={value.exemption}
              onValueChange={(v) => set({ exemption: v ?? "all" })}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="All exemptions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All exemptions</SelectItem>
                {exemptions.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Industry">
            <Select
              value={value.industry}
              onValueChange={(v) => set({ industry: v ?? "all" })}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="All industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All industries</SelectItem>
                {industries.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Filed date">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label="Filed on or after"
                value={value.dateFrom}
                max={value.dateTo || undefined}
                onChange={(e) => set({ dateFrom: e.target.value })}
                className="h-8"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                aria-label="Filed on or before"
                value={value.dateTo}
                min={value.dateFrom || undefined}
                onChange={(e) => set({ dateTo: e.target.value })}
                className="h-8"
              />
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}
