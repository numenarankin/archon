"use client";

import { useEffect, useState } from "react";
import { PlusIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  getOperatorDetail,
  getOperatorLeases,
  getOperatorLast12,
  type OperatorDetail,
  type OperatorLease,
  type OperatorLast12,
} from "@/lib/wells/queries";
import { fmtDate8, fmtPhone, fmtVol, P5_STATUS } from "@/lib/wells/format";
import {
  getOperatorCrmState,
  addOperatorToCrm,
  removeOperatorFromCrm,
} from "@/lib/wildcat/operator-crm-actions";

const numberFormatter = new Intl.NumberFormat("en-US");

function text(value: string | null | undefined): string {
  const v = value?.trim();
  return v ? v : "—";
}

/** Up to two initials for the monogram. */
function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/);
  if (words.length === 0 || words[0] === "") return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Assemble "street, city, ST zip" from the operator address parts. */
function operatorAddress(op: OperatorDetail["operator"]): string | null {
  if (!op) return null;
  const cityState = [op.city?.trim(), op.state?.trim()].filter(Boolean).join(", ");
  const tail = [cityState, op.zip ? String(op.zip) : null].filter(Boolean).join(" ");
  const full = [op.addr_line1?.trim(), op.addr_line2?.trim(), tail]
    .filter(Boolean)
    .join(", ");
  return full || null;
}

/** A compact stat tile. */
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 px-3 py-2.5">
      <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-heading text-base font-semibold tabular-nums leading-tight">
        {value}
      </span>
    </div>
  );
}

/** A label / value line in the details list. */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="truncate text-right text-sm font-medium tabular-nums">
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h3>
  );
}

/** Everything the profile modal renders for one operator. */
interface OperatorProfile {
  detail: OperatorDetail;
  leases: OperatorLease[];
  last12: OperatorLast12;
}

/**
 * The +/✓ toggle that adds this operator to the CRM (Wildcat unit, 'lead'
 * stage). Self-contained: checks its state when the operator changes,
 * optimistically flips on click, and reverts on failure.
 */
function CrmToggleButton({
  operatorNumber,
  profile,
}: {
  operatorNumber: number;
  profile: OperatorProfile;
}) {
  const [inCrm, setInCrm] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  // Mounted fresh per operator (keyed by operatorNumber), so state starts at
  // `null` and this effect only fetches — no synchronous reset needed.
  useEffect(() => {
    let cancelled = false;
    getOperatorCrmState(operatorNumber)
      .then(({ inCrm }) => !cancelled && setInCrm(inCrm))
      .catch(() => !cancelled && setInCrm(false));
    return () => {
      cancelled = true;
    };
  }, [operatorNumber]);

  async function toggle() {
    if (pending || inCrm === null) return;
    const next = !inCrm;
    setInCrm(next);
    setPending(true);
    try {
      const op = profile.detail.operator;
      if (next) {
        await addOperatorToCrm({
          operatorNumber,
          name: op?.operator_name ?? `Operator #${operatorNumber}`,
          phone: op?.phone ? fmtPhone(op.phone) : null,
          address: operatorAddress(op),
          city: op?.city ?? null,
          state: op?.state ?? null,
          zip: op?.zip ?? null,
          p5Status: op?.p5_status ?? null,
          wellCount: profile.detail.wellCount,
        });
      } else {
        await removeOperatorFromCrm(operatorNumber);
      }
    } catch {
      setInCrm(!next); // revert
    } finally {
      setPending(false);
    }
  }

  const busy = pending || inCrm === null;
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={inCrm ? "Remove from CRM" : "Add to CRM"}
      title={inCrm ? "In CRM — click to remove" : "Add to CRM"}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
        inCrm
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground",
        busy && "opacity-70"
      )}
    >
      {pending || inCrm === null ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : inCrm ? (
        <CheckIcon className="size-4" />
      ) : (
        <PlusIcon className="size-4" />
      )}
    </button>
  );
}

interface OperatorProfileModalProps {
  open: boolean;
  operatorNumber: number | null;
  operatorName: string;
  onClose: () => void;
}

export function OperatorProfileModal({
  open,
  operatorNumber,
  operatorName,
  onClose,
}: OperatorProfileModalProps) {
  const [result, setResult] = useState<{
    operatorNumber: number;
    profile: OperatorProfile | null;
  } | null>(null);

  useEffect(() => {
    if (!open || operatorNumber == null) return;
    let cancelled = false;
    Promise.all([
      getOperatorDetail(operatorNumber),
      getOperatorLeases(operatorNumber),
      getOperatorLast12(operatorNumber),
    ])
      .then(([detail, leases, last12]) => {
        if (!cancelled) {
          setResult({ operatorNumber, profile: { detail, leases, last12 } });
        }
      })
      .catch(() => {
        if (!cancelled) setResult({ operatorNumber, profile: null });
      });
    return () => {
      cancelled = true;
    };
  }, [open, operatorNumber]);

  const current =
    result && result.operatorNumber === operatorNumber ? result : null;
  const profile = current?.profile ?? null;
  const status: "idle" | "loading" | "error" =
    current == null ? "loading" : current.profile == null ? "error" : "idle";

  const op = profile?.detail.operator ?? null;
  const officers = profile?.detail.officers ?? [];
  const leases = profile?.leases ?? [];
  const p5 = op?.p5_status ? P5_STATUS[op.p5_status] ?? op.p5_status : null;

  return (
    <SwipeUpModal
      open={open}
      onClose={onClose}
      title={op?.operator_name ?? operatorName}
      description={
        operatorNumber != null
          ? [`RRC #${operatorNumber}`, p5].filter(Boolean).join(" · ")
          : undefined
      }
      className="max-w-xl"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        {status === "loading" && (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        )}

        {status === "error" && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Couldn&apos;t load this operator&apos;s details.
          </p>
        )}

        {profile && status === "idle" && operatorNumber != null && (
          <>
            {/* Identity strip: monogram + classification + RRC number. */}
            <div className="flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary font-heading text-lg font-bold text-primary-foreground ring-1 ring-foreground/10">
                {initials(op?.operator_name ?? operatorName)}
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap gap-1.5">
                  {p5 && (
                    <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-foreground/10">
                      {p5}
                    </span>
                  )}
                  {op?.state && (
                    <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-foreground/10">
                      {op.state}
                    </span>
                  )}
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  RRC #{operatorNumber}
                  {op?.last_p5_date
                    ? ` · last P-5 ${fmtDate8(op.last_p5_date)}`
                    : ""}
                </span>
              </div>
              <div className="ml-auto self-start">
                <CrmToggleButton
                  key={operatorNumber}
                  operatorNumber={operatorNumber}
                  profile={profile}
                />
              </div>
            </div>

            {/* Hero: wells operated, big. */}
            <div className="rounded-2xl border bg-muted/30 p-5">
              <div className="font-mono text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground">
                Wells operated
              </div>
              <div className="mt-1 font-heading text-4xl font-bold tabular-nums leading-none">
                {numberFormatter.format(profile.detail.wellCount)}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium text-muted-foreground tabular-nums">
                <span>{fmtVol(profile.last12.oil_last12)} bbl oil · 12mo</span>
                <span>{fmtVol(profile.last12.gas_last12)} MCF gas · 12mo</span>
              </div>
            </div>

            {/* Quick stats. */}
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Status" value={p5 ?? "—"} />
              <Stat label="Leases" value={numberFormatter.format(leases.length)} />
              <Stat
                label="Officers"
                value={numberFormatter.format(officers.length)}
              />
              <Stat label="Oil 12mo" value={fmtVol(profile.last12.oil_last12)} />
              <Stat label="Gas 12mo" value={fmtVol(profile.last12.gas_last12)} />
              <Stat label="Last P-5" value={fmtDate8(op?.last_p5_date) ?? "—"} />
            </div>

            {/* Contact. */}
            <div>
              <SectionTitle>Contact</SectionTitle>
              <div className="divide-y divide-border/60 rounded-lg border px-3">
                <Row label="Address" value={text(operatorAddress(op))} />
                <Row label="Phone" value={fmtPhone(op?.phone) ?? "—"} />
                {op?.oil_gatherer && (
                  <Row label="Oil gatherer" value={text(op.oil_gatherer)} />
                )}
                {op?.gas_gatherer && (
                  <Row label="Gas gatherer" value={text(op.gas_gatherer)} />
                )}
              </div>
            </div>

            {/* Officers / principals. */}
            <div>
              <SectionTitle>
                Officers &amp; principals · {officers.length}
              </SectionTitle>
              {officers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No officers on file.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {officers.map((p, i) => (
                    <div
                      key={`${p.officer_name}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/5 font-mono text-[0.6rem] font-semibold text-muted-foreground ring-1 ring-inset ring-foreground/10">
                          {initials(p.officer_name ?? "?")}
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">
                            {p.officer_name ?? "Unknown"}
                          </span>
                          {[p.officer_city, p.officer_state]
                            .filter(Boolean)
                            .length > 0 && (
                            <span className="truncate text-xs text-muted-foreground">
                              {[p.officer_city, p.officer_state]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      {p.officer_title && (
                        <span className="shrink-0 rounded-full bg-foreground/5 px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground ring-1 ring-inset ring-foreground/10">
                          {p.officer_title}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Leases (top producers). */}
            {leases.length > 0 && (
              <div>
                <SectionTitle>Leases · {leases.length}</SectionTitle>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50 text-muted-foreground">
                        <th className="px-2.5 py-1.5 text-left font-medium">
                          Lease
                        </th>
                        <th className="px-2.5 py-1.5 text-right font-medium">
                          Wells
                        </th>
                        <th className="px-2.5 py-1.5 text-right font-medium">
                          Oil
                        </th>
                        <th className="px-2.5 py-1.5 text-right font-medium">
                          Gas
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {leases.slice(0, 8).map((l) => (
                        <tr
                          key={`${l.oil_gas_code}-${l.district_no}-${l.lease_no}`}
                        >
                          <td className="px-2.5 py-1.5">
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
                          <td className="px-2.5 py-1.5 text-right tabular-nums">
                            {numberFormatter.format(l.well_count)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums">
                            {fmtVol(l.oil_last12)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums">
                            {fmtVol(l.gas_last12)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {leases.length > 8 && (
                    <p className="px-2.5 py-1.5 text-[10px] text-muted-foreground">
                      Showing top 8 of {leases.length.toLocaleString()} · last 12
                      months, oil in bbl, gas in MCF
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </SwipeUpModal>
  );
}
