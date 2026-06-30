"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getOperatorDetail,
  getOperatorLeases,
  getOperatorLast12,
  type OperatorDetail,
  type OperatorLease,
  type OperatorLast12,
} from "@/lib/wells/queries";
import { COUNTY_NAMES } from "@/lib/wells/counties";
import { api8, fmtDate8, fmtPhone, fmtVol, P5_STATUS } from "@/lib/wells/format";

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
  excludePlugged = false,
}: {
  operatorNumber: number | null;
  onClose: () => void;
  onSelectWell: (api: number, lng: number | null, lat: number | null) => void;
  onSelectPrincipal: (name: string) => void;
  excludePlugged?: boolean;
}) {
  const [detail, setDetail] = useState<OperatorDetail | null>(null);
  const [leases, setLeases] = useState<OperatorLease[]>([]);
  const [last12, setLast12] = useState<OperatorLast12 | null>(null);
  const [tab, setTab] = useState<"wells" | "leases">("wells");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (operatorNumber == null) return;
      setLoading(true);
      setError(null);
      setDetail(null);
      setLeases([]);
      setLast12(null);
      setTab("wells");
      try {
        const [d, ls, l12] = await Promise.all([
          getOperatorDetail(operatorNumber),
          getOperatorLeases(operatorNumber),
          getOperatorLast12(operatorNumber),
        ]);
        if (active) {
          setDetail(d);
          setLeases(ls);
          setLast12(l12);
        }
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
  const allWells = detail?.wells ?? [];
  const totalWellCount = detail?.wellCount ?? 0;
  // True when the operator has more wells than were fetched (the list is a
  // first-N sample). Used to caveat the active-only count below.
  const capped = allWells.length < totalWellCount;
  // When excluding plugged wells, drop them from the list and the count. The
  // count is derived from the fetched wells, so for very large operators (where
  // the list is capped) it reflects the fetched sample, like the existing list.
  const wells = excludePlugged ? allWells.filter((w) => !w.is_plugged) : allWells;
  const wellCount = excludePlugged ? wells.length : totalWellCount;
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
              <Row label="Phone" value={fmtPhone(op?.phone)} />
              <Row label="Last P-5" value={fmtDate8(op?.last_p5_date)} />
              <Row
                label="Oil (12mo)"
                value={last12 ? `${fmtVol(last12.oil_last12)} bbl` : null}
              />
              <Row
                label="Gas (12mo)"
                value={last12 ? `${fmtVol(last12.gas_last12)} MCF` : null}
              />
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

            {/* Wells / Leases tabs */}
            <section>
              <div className="mb-2 flex gap-1 border-b">
                {(["wells", "leases"] as const).map((t) => {
                  const count = t === "wells" ? wellCount : leases.length;
                  return (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                        tab === t
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t} ({count.toLocaleString()})
                    </button>
                  );
                })}
              </div>

              {tab === "wells" && (
                <>
                  {!excludePlugged && capped && (
                    <p className="mb-1 text-xs text-muted-foreground">
                      Showing first {wells.length.toLocaleString()}
                    </p>
                  )}
                  {excludePlugged && capped && (
                    <p className="mb-1 text-xs text-muted-foreground">
                      Active wells among the first{" "}
                      {allWells.length.toLocaleString()} of{" "}
                      {totalWellCount.toLocaleString()}
                    </p>
                  )}
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
                </>
              )}

              {tab === "leases" &&
                (leases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No production on record for this operator.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-md border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50 text-muted-foreground">
                          <th className="px-2 py-1.5 text-left font-medium">Lease</th>
                          <th className="px-2 py-1.5 text-right font-medium">Wells</th>
                          <th className="px-2 py-1.5 text-right font-medium">Oil</th>
                          <th className="px-2 py-1.5 text-right font-medium">Gas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {leases.map((l) => (
                          <tr
                            key={`${l.oil_gas_code}-${l.district_no}-${l.lease_no}`}
                            className="hover:bg-muted"
                          >
                            <td className="px-2 py-1.5">
                              <div
                                className="truncate font-medium"
                                title={l.lease_name ?? undefined}
                              >
                                {l.lease_name ?? `Lease ${l.lease_no}`}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                #{l.lease_no} · Dist {l.district_no} ·{" "}
                                {l.oil_gas_code === "O" ? "Oil" : "Gas"}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {l.well_count.toLocaleString()}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {fmtVol(l.oil_last12)}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {fmtVol(l.gas_last12)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="px-2 py-1.5 text-[10px] text-muted-foreground">
                      Last 12 months · oil in bbl, gas in MCF
                    </p>
                  </div>
                ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
