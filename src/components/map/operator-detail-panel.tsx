"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getOperatorDetail, type OperatorDetail } from "@/lib/wells/queries";
import { COUNTY_NAMES } from "@/lib/wells/counties";
import { api8, fmtDate8, P5_STATUS } from "@/lib/wells/format";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function OperatorDetailPanel({
  operatorNumber,
  onClose,
  onSelectWell,
  onSelectPrincipal,
}: {
  operatorNumber: number | null;
  onClose: () => void;
  onSelectWell: (api: number, lng: number | null, lat: number | null) => void;
  onSelectPrincipal: (name: string) => void;
}) {
  const [detail, setDetail] = useState<OperatorDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (operatorNumber == null) return;
      setLoading(true);
      setError(null);
      setDetail(null);
      try {
        const d = await getOperatorDetail(operatorNumber);
        if (active) setDetail(d);
      } catch {
        if (active) setError("Could not load operator detail.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [operatorNumber]);

  if (operatorNumber == null) return null;

  const op = detail?.operator;
  const officers = detail?.officers ?? [];
  const wells = detail?.wells ?? [];
  const wellCount = detail?.wellCount ?? 0;
  const address = op
    ? [op.addr_line1, op.addr_line2, [op.city, op.state, op.zip || ""].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <div className="flex h-full w-[24rem] shrink-0 flex-col overflow-y-auto border-l bg-background shadow-xl">
      <div className="sticky top-0 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <div className="truncate font-heading text-lg font-semibold tracking-tight">
            {op?.operator_name ?? `Operator #${operatorNumber}`}
          </div>
          <div className="text-xs text-muted-foreground">
            RRC operator #{operatorNumber}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && (
          <>
            {/* P-5 profile */}
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                P-5 profile
              </h3>
              <Row
                label="Status"
                value={op?.p5_status ? P5_STATUS[op.p5_status] ?? op.p5_status : null}
              />
              <Row label="Address" value={address} />
              <Row label="Last P-5" value={fmtDate8(op?.last_p5_date)} />
              <Row label="Oil gatherer" value={op?.oil_gatherer || null} />
              <Row label="Gas gatherer" value={op?.gas_gatherer || null} />
            </section>

            {/* Officers */}
            {officers.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Officers &amp; principals ({officers.length})
                </h3>
                <ul className="flex flex-col divide-y rounded-md border">
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

            {/* Wells */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Wells ({wellCount.toLocaleString()})
                {wells.length < wellCount && (
                  <span className="ml-1 font-normal normal-case">
                    — showing first {wells.length.toLocaleString()}
                  </span>
                )}
              </h3>
              <ul className="flex flex-col divide-y rounded-md border">
                {wells.map((w) => (
                  <li key={w.api_number}>
                    <button
                      onClick={() => onSelectWell(w.api_number, w.longitude, w.latitude)}
                      className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="font-mono text-xs">{api8(w.api_number)}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {w.county_code != null && COUNTY_NAMES[w.county_code]
                          ? COUNTY_NAMES[w.county_code]
                          : null}
                        {w.oil_gas_label && <span>· {w.oil_gas_label}</span>}
                        {w.is_plugged && <span className="text-destructive">· P</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
