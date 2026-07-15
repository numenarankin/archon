"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { FilingsTable } from "@/components/numena/filings-table";
import { InvestorsTable } from "@/components/numena/investors-table";
import { BdsTable } from "@/components/numena/bds-table";
import { ProspectExport } from "@/components/numena/prospect-export";
import {
  FilingsFilters,
  DEFAULT_FILING_FILTERS,
  type FilingFilters,
} from "@/components/numena/filings-filters";
import type {
  BusinessDeveloper,
  Filing,
  Investor,
  ProspectingCategory,
} from "@/lib/numena/prospecting";

const TABS: { value: ProspectingCategory; label: string }[] = [
  { value: "filings", label: "Filings" },
  { value: "investors", label: "Investors" },
  { value: "bds", label: "BDs" },
];

/** Distinct values, preserving the given priority order, then alphabetical. */
function distinctSorted(values: string[], priority: string[] = []): string[] {
  const unique = Array.from(new Set(values));
  return unique.sort((a, b) => {
    const ia = priority.indexOf(a);
    const ib = priority.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
    }
    if (a === "—") return 1;
    if (b === "—") return -1;
    return a.localeCompare(b);
  });
}

export function ProspectingWorkspace({
  filings,
  investors,
  bds,
}: {
  filings: Filing[];
  investors: Investor[];
  bds: BusinessDeveloper[];
}) {
  const [tab, setTab] = useState<ProspectingCategory>("filings");
  const [filters, setFilters] = useState<FilingFilters>(DEFAULT_FILING_FILTERS);

  const exemptions = useMemo(
    () =>
      distinctSorted(
        filings.map((f) => f.exemption),
        ["506(c)", "506(b)", "504"]
      ),
    [filings]
  );
  const industries = useMemo(
    () => distinctSorted(filings.map((f) => f.industry)),
    [filings]
  );

  const filteredFilings = useMemo(
    () =>
      filings.filter((f) => {
        if (filters.exemption !== "all" && f.exemption !== filters.exemption) {
          return false;
        }
        if (filters.industry !== "all" && f.industry !== filters.industry) {
          return false;
        }
        const filedDate = f.filedAt.slice(0, 10);
        if (filters.dateFrom && filedDate < filters.dateFrom) return false;
        if (filters.dateTo && filedDate > filters.dateTo) return false;
        return true;
      }),
    [filings, filters]
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Sub-tabs on the left; the Filings filter menu sits across on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "font-heading text-2xl font-semibold tracking-tight transition-colors",
                tab === t.value
                  ? "text-foreground"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "filings" && (
          <div className="flex items-center gap-2">
            <ProspectExport
              exemption={filters.exemption}
              industry={filters.industry}
            />
            <FilingsFilters
              exemptions={exemptions}
              industries={industries}
              value={filters}
              onChange={setFilters}
            />
          </div>
        )}
      </div>

      {tab === "filings" && <FilingsTable filings={filteredFilings} />}
      {tab === "investors" && <InvestorsTable investors={investors} />}
      {tab === "bds" && <BdsTable bds={bds} />}
    </div>
  );
}
