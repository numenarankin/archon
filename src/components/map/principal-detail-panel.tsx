"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPrincipalDetail, type PrincipalDetail } from "@/lib/wells/queries";
import { P5_STATUS } from "@/lib/wells/format";

export function PrincipalDetailPanel({
  name,
  onClose,
  onSelectOperator,
}: {
  name: string | null;
  onClose: () => void;
  onSelectOperator: (operatorNumber: number) => void;
}) {
  const [detail, setDetail] = useState<PrincipalDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (name == null) return;
      setLoading(true);
      setError(null);
      setDetail(null);
      try {
        const d = await getPrincipalDetail(name);
        if (active) setDetail(d);
      } catch {
        if (active) setError("Could not load principal detail.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [name]);

  if (name == null) return null;

  const affiliations = detail?.affiliations ?? [];
  const where = affiliations.find((a) => a.officer_city || a.officer_state);
  const location = where
    ? [where.officer_city, where.officer_state].filter(Boolean).join(", ")
    : null;

  return (
    <div className="flex h-full w-[24rem] shrink-0 flex-col overflow-y-auto border-l bg-background shadow-xl">
      <div className="sticky top-0 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <div className="truncate font-heading text-lg font-semibold tracking-tight">
            {name}
          </div>
          <div className="text-xs text-muted-foreground">
            Principal / officer{location ? ` · ${location}` : ""}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {loading && <Skeleton className="h-40 w-full" />}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Affiliated operators ({affiliations.length})
            </h3>
            {affiliations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No operators on file.</p>
            ) : (
              <ul className="flex flex-col divide-y rounded-md border">
                {affiliations.map((a, i) => (
                  <li key={`${a.operator_number}-${i}`}>
                    <button
                      onClick={() => onSelectOperator(a.operator_number)}
                      className="flex w-full flex-col gap-0.5 px-2.5 py-2 text-left hover:bg-muted"
                    >
                      <span className="text-sm font-medium text-primary">
                        {a.operator_name ?? `Operator #${a.operator_number}`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {[
                          a.officer_title,
                          a.p5_status ? P5_STATUS[a.p5_status] ?? a.p5_status : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
