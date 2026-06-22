"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getWellDetail, type WellDetail } from "@/lib/wells/queries";
import { useMapAiContext, type MapWellContext } from "@/lib/ai/map-context";
import { COUNTY_NAMES } from "@/lib/wells/counties";
import { api8, fmtDate8, P5_STATUS } from "@/lib/wells/format";

/** Map a fetched WellDetail into the assistant's map context shape. */
function toMapWell(api: number, d: WellDetail): MapWellContext {
  const w = d.well;
  const op = d.operator;
  return {
    api,
    district: w?.admin_district ?? null,
    county: w?.county_code != null ? COUNTY_NAMES[w.county_code] ?? null : null,
    oilGas: w?.oil_gas_label ?? null,
    totalDepth: w?.total_depth ?? null,
    plugged: w?.is_plugged ?? null,
    nFormations: w?.n_formations ?? null,
    operatorName: op?.operator_display_name ?? op?.operator_name ?? null,
    operatorNumber: op?.operator_number ?? null,
    operatorStatus: op?.p5_status ? P5_STATUS[op.p5_status] ?? op.p5_status : null,
    officerCount: op?.officer_count ?? null,
  };
}

const SOURCE_LABEL: Record<string, string> = {
  permit: "Current operator (most recent permit)",
  h15: "Current operator (H-15 filer)",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function WellDetailPanel({
  api,
  onClose,
  onSelectOperator,
  onSelectPrincipal,
}: {
  api: number | null;
  onClose: () => void;
  onSelectOperator: (operatorNumber: number) => void;
  onSelectPrincipal: (name: string) => void;
}) {
  const [detail, setDetail] = useState<WellDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Wrapped in an async function so no setState runs synchronously in the
    // effect body (react-hooks/set-state-in-effect).
    async function load() {
      if (api == null) {
        useMapAiContext.getState().setWell(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const d = await getWellDetail(api);
        if (active) {
          setDetail(d);
          useMapAiContext.getState().setWell(toMapWell(api, d));
        }
      } catch {
        if (active) {
          setError("Could not load detail. Has the data been loaded into Supabase?");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [api]);

  if (api == null) return null;

  const well = detail?.well;
  const op = detail?.operator;
  const officers = detail?.officers ?? [];
  const operatorName = op?.operator_display_name ?? op?.operator_name ?? null;
  const hasProfile = Boolean(op?.operator_number && op?.operator_name);

  return (
    <div className="flex h-full w-[22rem] shrink-0 flex-col overflow-y-auto border-l bg-background shadow-xl">
      <div className="sticky top-0 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div>
          <div className="font-heading text-lg font-semibold tracking-tight">
            API {api8(api)}
          </div>
          <div className="text-xs text-muted-foreground">RRC well bore</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && (
          <>
            {/* Well facts */}
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Well
              </h3>
              <Row label="District" value={well?.admin_district ?? null} />
              <Row label="County code" value={well?.county_code ?? null} />
              <Row label="Type" value={well?.oil_gas_label ?? null} />
              <Row label="Location" value={well?.water_land ?? null} />
              <Row
                label="Total depth"
                value={well?.total_depth ? `${well.total_depth.toLocaleString()} ft` : null}
              />
              <Row label="Plugged" value={well ? (well.is_plugged ? "Yes" : "No") : null} />
              <Row label="Plugged date" value={well?.plugged_d ?? null} />
              <Row label="Formations" value={well?.n_formations || null} />
              <Row label="Completions" value={well?.n_completions || null} />
              {!well && (
                <p className="text-sm text-muted-foreground">
                  Well not found in the database.
                </p>
              )}
            </section>

            {/* Operator */}
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Operator
              </h3>
              {operatorName ? (
                <>
                  {op?.operator_number ? (
                    <button
                      onClick={() => onSelectOperator(op.operator_number as number)}
                      className="text-left text-base font-semibold text-primary hover:underline"
                    >
                      {operatorName}
                    </button>
                  ) : (
                    <div className="text-base font-semibold">{operatorName}</div>
                  )}
                  {op?.operator_source && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {SOURCE_LABEL[op.operator_source] ?? op.operator_source}
                    </div>
                  )}
                  {!hasProfile && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Plugging-record name only (no P-5 profile on file)
                    </div>
                  )}
                  {hasProfile && (
                    <div className="mt-2">
                      <Row
                        label="Operator no."
                        value={op?.operator_number ?? null}
                      />
                      <Row
                        label="P-5 status"
                        value={op?.p5_status ? P5_STATUS[op.p5_status] ?? op.p5_status : null}
                      />
                      <Row
                        label="Address"
                        value={
                          op?.addr_line1
                            ? [op.addr_line1, op.city, op.state]
                                .filter(Boolean)
                                .join(", ")
                            : null
                        }
                      />
                      <Row label="Last P-5" value={fmtDate8(op?.last_p5_date)} />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No operator on file (typically a pre-1976 well).
                </p>
              )}
            </section>

            {/* Officers */}
            {officers.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Officers &amp; principals ({officers.length})
                </h3>
                <ul className="flex flex-col rounded-md border divide-y">
                  {officers.map((o, i) => (
                    <li key={i}>
                      <button
                        onClick={() => o.officer_name && onSelectPrincipal(o.officer_name)}
                        className="w-full px-2.5 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        <div className="font-medium text-primary">{o.officer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[o.officer_title, [o.officer_city, o.officer_state].filter(Boolean).join(", ")]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
