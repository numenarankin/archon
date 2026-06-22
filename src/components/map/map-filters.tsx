"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { searchOperators, type OperatorMatch } from "@/lib/wells/queries";
import { COUNTY_OPTIONS } from "@/lib/wells/counties";

export type MapMode = "wells" | "operators";

export interface Filters {
  mode: MapMode;
  oilGas: "all" | "O" | "G";
  plugged: "all" | "plugged" | "active";
  district: "all" | number;
  county: "all" | number;
  operator: OperatorMatch | null;
  // operator mode: well-count range (null = unbounded)
  minWells: number | null;
  maxWells: number | null;
}

export const DEFAULT_FILTERS: Filters = {
  mode: "wells",
  oilGas: "all",
  plugged: "all",
  district: "all",
  county: "all",
  operator: null,
  minWells: null,
  maxWells: null,
};

const DISTRICTS = Array.from({ length: 14 }, (_, i) => i + 1);

function parseCount(v: string): number | null {
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

function Seg<T extends string | number>({
  value,
  options,
  onSelect,
}: {
  value: T;
  options: { label: string; v: T }[];
  onSelect: (v: T) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <Button
          key={String(o.v)}
          size="xs"
          variant={value === o.v ? "default" : "outline"}
          onClick={() => onSelect(o.v)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function MapFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const [opQuery, setOpQuery] = useState("");
  const [opResults, setOpResults] = useState<OperatorMatch[]>([]);
  const [countyQuery, setCountyQuery] = useState("");
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  useEffect(() => {
    if (filters.operator) return;
    const q = opQuery.trim();
    const t = setTimeout(() => {
      if (q.length < 2) {
        setOpResults([]);
        return;
      }
      searchOperators(q).then(setOpResults).catch(() => setOpResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [opQuery, filters.operator]);

  const countyName =
    filters.county === "all"
      ? null
      : COUNTY_OPTIONS.find((c) => c.code === filters.county)?.name ?? null;

  const countyResults = useMemo(() => {
    const q = countyQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    return COUNTY_OPTIONS.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [countyQuery]);

  return (
    <div className="absolute left-3 top-3 z-10 flex w-64 flex-col gap-3 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
      <div className="font-heading text-sm font-semibold">Map</div>

      <Field label="Show">
        <Seg
          value={filters.mode}
          onSelect={(v) => set({ mode: v })}
          options={[
            { label: "Wells", v: "wells" },
            { label: "Operators", v: "operators" },
          ]}
        />
      </Field>

      {filters.mode === "operators" ? (
        <Field label="Wells operated">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={filters.minWells ?? ""}
              placeholder="Min"
              onChange={(e) => set({ minWells: parseCount(e.target.value) })}
              className="h-8"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={filters.maxWells ?? ""}
              placeholder="Max"
              onChange={(e) => set({ maxWells: parseCount(e.target.value) })}
              className="h-8"
            />
          </div>
        </Field>
      ) : (
        <>
          <Field label="Type">
            <Seg
              value={filters.oilGas}
              onSelect={(v) => set({ oilGas: v })}
              options={[
                { label: "All", v: "all" },
                { label: "Oil", v: "O" },
                { label: "Gas", v: "G" },
              ]}
            />
          </Field>

          <Field label="Status">
            <Seg
              value={filters.plugged}
              onSelect={(v) => set({ plugged: v })}
              options={[
                { label: "All", v: "all" },
                { label: "Active", v: "active" },
                { label: "Plugged", v: "plugged" },
              ]}
            />
          </Field>

          <Field label="District">
            <Select
              value={String(filters.district)}
              onValueChange={(v) => set({ district: v === "all" ? "all" : Number(v) })}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="All districts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All districts</SelectItem>
                {DISTRICTS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    District {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="County">
            {countyName ? (
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-sm">
                <span className="truncate">{countyName}</span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Clear county"
                  onClick={() => {
                    set({ county: "all" });
                    setCountyQuery("");
                  }}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={countyQuery}
                  onChange={(e) => setCountyQuery(e.target.value)}
                  placeholder="Search county…"
                  className="h-8"
                />
                {countyResults.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                    {countyResults.map((c) => (
                      <li key={c.code}>
                        <button
                          className="w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            set({ county: c.code });
                            setCountyQuery("");
                          }}
                        >
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Field>

          <Field label="Operator">
            {filters.operator ? (
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-sm">
                <span className="truncate">{filters.operator.operator_name}</span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Clear operator"
                  onClick={() => {
                    set({ operator: null });
                    setOpQuery("");
                    setOpResults([]);
                  }}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={opQuery}
                  onChange={(e) => setOpQuery(e.target.value)}
                  placeholder="Search operator name…"
                  className="h-8"
                />
                {opResults.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                    {opResults.map((o) => (
                      <li key={o.operator_number}>
                        <button
                          className="w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            set({ operator: o });
                            setOpResults([]);
                          }}
                        >
                          {o.operator_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Field>
        </>
      )}
    </div>
  );
}
