"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OperatorsTable } from "@/components/wildcat/operators-table";
import { loadOperatorPoints, type OperatorPoint } from "@/lib/wells/queries";

/** How many rows to add each time the user clicks "Show more". */
const PAGE = 100;

const numberFormatter = new Intl.NumberFormat("en-US");

/**
 * Wildcat prospecting: every RRC operator we plot on /map, as a searchable
 * table. Same source as the map's operator mode (`public/operators.json`,
 * placed by mailing ZIP), sorted by wells operated. Clicking an operator opens
 * the full profile (P-5, officers, production, leases) with an add-to-CRM toggle.
 */
export function OperatorProspectingWorkspace() {
  const [operators, setOperators] = useState<OperatorPoint[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => {
    let cancelled = false;
    loadOperatorPoints()
      .then((all) => {
        if (cancelled) return;
        // Sort by wells operated, descending — the map's headline metric.
        setOperators([...all].sort((a, b) => b.w - a.w));
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!operators) return [];
    const q = query.trim().toLowerCase();
    if (!q) return operators;
    return operators.filter(
      (op) =>
        op.nm.toLowerCase().includes(q) ||
        op.c.toLowerCase().includes(q) ||
        op.s.toLowerCase().includes(q)
    );
  }, [operators, query]);

  // Reset the page window whenever the search changes.
  function handleQuery(value: string) {
    setQuery(value);
    setVisible(PAGE);
  }

  const shown = filtered.slice(0, visible);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Operators
        </h1>
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            placeholder="Search operator, city, state…"
            className="pl-9"
          />
        </div>
      </div>

      {error ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Couldn&apos;t load operators.
        </p>
      ) : operators === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          <OperatorsTable operators={shown} />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="tabular-nums">
              Showing {numberFormatter.format(shown.length)} of{" "}
              {numberFormatter.format(filtered.length)}
              {query ? " matching" : ""} operators
            </span>
            {shown.length < filtered.length && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisible((v) => v + PAGE)}
              >
                Show more
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
