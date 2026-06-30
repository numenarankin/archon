"use client";

import { useEffect, useState } from "react";
import { PlusIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getIssuerProfile } from "@/lib/numena/issuer-actions";
import {
  getIssuerCrmState,
  addIssuerToCrm,
  removeIssuerFromCrm,
} from "@/lib/numena/crm-actions";
import type { IssuerProfile } from "@/lib/numena/prospecting";

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function compactMoney(amount: number | null): string {
  return amount == null ? "—" : compactCurrency.format(amount);
}

function date(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFormatter.format(d);
}

function text(value: string | null | undefined): string {
  const v = value?.trim();
  return v ? v : "—";
}

/**
 * Normalize the messy EDGAR phone strings. US 10-digit and 1+10-digit numbers
 * get pretty-printed; anything else (international, irregular) is left as-is so
 * we never mangle a real number.
 */
function formatPhone(raw: string | null): string {
  if (!raw) return "—";
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return trimmed;
}

/** Up to two initials for the monogram. */
function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/);
  if (words.length === 0 || words[0] === "") return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function soldPct(profile: IssuerProfile): number | null {
  const { totalOffering, totalSold } = profile;
  if (totalOffering == null || totalOffering <= 0 || totalSold == null) {
    return null;
  }
  return Math.min(100, Math.round((totalSold / totalOffering) * 100));
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

/**
 * The +/✓ toggle that adds this issuer to the CRM (Numena unit, 'lead' stage).
 * Self-contained: checks its state when the profile changes, optimistically
 * flips on click, and reverts on failure.
 */
function CrmToggleButton({ profile }: { profile: IssuerProfile }) {
  const sourceRef = profile.cik ?? profile.accessionNo;
  const [inCrm, setInCrm] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setInCrm(null);
    getIssuerCrmState(sourceRef)
      .then(({ inCrm }) => !cancelled && setInCrm(inCrm))
      .catch(() => !cancelled && setInCrm(false));
    return () => {
      cancelled = true;
    };
  }, [sourceRef]);

  async function toggle() {
    if (pending || inCrm === null) return;
    const next = !inCrm;
    setInCrm(next);
    setPending(true);
    try {
      if (next) {
        await addIssuerToCrm({
          sourceRef,
          name: profile.name,
          industry: profile.industry,
          phone: profile.phone,
          address: profile.address,
          entityType: profile.entityType,
          jurisdiction: profile.jurisdiction,
          exemption: profile.exemption,
          totalOffering: profile.totalOffering,
          accessionNo: profile.accessionNo,
        });
      } else {
        await removeIssuerFromCrm(sourceRef);
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

interface IssuerProfileModalProps {
  open: boolean;
  accessionNo: string | null;
  issuerName: string;
  onClose: () => void;
}

export function IssuerProfileModal({
  open,
  accessionNo,
  issuerName,
  onClose,
}: IssuerProfileModalProps) {
  const [result, setResult] = useState<{
    accessionNo: string;
    profile: IssuerProfile | null;
  } | null>(null);

  useEffect(() => {
    if (!open || !accessionNo) return;
    let cancelled = false;
    getIssuerProfile(accessionNo)
      .then((data) => {
        if (!cancelled) setResult({ accessionNo, profile: data });
      })
      .catch(() => {
        if (!cancelled) setResult({ accessionNo, profile: null });
      });
    return () => {
      cancelled = true;
    };
  }, [open, accessionNo]);

  const current =
    result && result.accessionNo === accessionNo ? result : null;
  const profile = current?.profile ?? null;
  const status: "idle" | "loading" | "error" =
    current == null ? "loading" : current.profile == null ? "error" : "idle";

  const pct = profile ? soldPct(profile) : null;

  return (
    <SwipeUpModal
      open={open}
      onClose={onClose}
      title={profile?.name ?? issuerName}
      description={
        profile
          ? [profile.entityType, profile.jurisdiction]
              .filter(Boolean)
              .join(" · ") || undefined
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
            Couldn&apos;t load this issuer&apos;s details.
          </p>
        )}

        {profile && status === "idle" && (
          <>
            {/* Identity strip: monogram + classification + CIK. */}
            <div className="flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary font-heading text-lg font-bold text-primary-foreground ring-1 ring-foreground/10">
                {initials(profile.name)}
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap gap-1.5">
                  {profile.entityType && (
                    <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-foreground/10">
                      {profile.entityType}
                    </span>
                  )}
                  {profile.jurisdiction && (
                    <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-foreground/10">
                      {profile.jurisdiction}
                    </span>
                  )}
                  <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-foreground/10">
                    {profile.exemption}
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  CIK {text(profile.cik)}
                  {profile.yearOfInception
                    ? ` · founded ${profile.yearOfInception}`
                    : ""}
                </span>
              </div>
              <div className="ml-auto self-start">
                <CrmToggleButton profile={profile} />
              </div>
            </div>

            {/* Hero: the offering, big. */}
            <div className="rounded-2xl border bg-muted/30 p-5">
              <div className="font-mono text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground">
                Total offering
              </div>
              <div className="mt-1 font-heading text-4xl font-bold tabular-nums leading-none">
                {compactMoney(profile.totalOffering)}
              </div>
              {pct != null && (
                <div className="mt-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs font-medium text-muted-foreground tabular-nums">
                    <span>{compactMoney(profile.totalSold)} sold ({pct}%)</span>
                    <span>{compactMoney(profile.totalRemaining)} left</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick stats. */}
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Industry" value={text(profile.industry)} />
              <Stat
                label="Min Invest"
                value={compactMoney(profile.minInvestment)}
              />
              <Stat label="Investors" value={profile.numTotalInvestors ?? "—"} />
              <Stat label="Non-Accred" value={profile.numNonAccred ?? "—"} />
              <Stat label="First Sale" value={date(profile.dateFirstSale)} />
              <Stat
                label="Securities"
                value={
                  profile.securitiesTypes.length > 0
                    ? profile.securitiesTypes.join(", ")
                    : "—"
                }
              />
            </div>

            {/* Contact. */}
            <div>
              <SectionTitle>Contact</SectionTitle>
              <div className="divide-y divide-border/60 rounded-lg border px-3">
                <Row label="Address" value={text(profile.address)} />
                <Row label="Phone" value={formatPhone(profile.phone)} />
              </div>
            </div>

            {/* People. */}
            <div>
              <SectionTitle>People · {profile.people.length}</SectionTitle>
              {profile.people.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No related persons disclosed.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {profile.people.map((p, i) => (
                    <div
                      key={`${p.name}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/5 font-mono text-[0.6rem] font-semibold text-muted-foreground ring-1 ring-inset ring-foreground/10">
                          {initials(p.name)}
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">
                            {p.name}
                          </span>
                          {p.location && (
                            <span className="truncate text-xs text-muted-foreground">
                              {p.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        {p.relationships.map((r) => (
                          <span
                            key={r}
                            className="rounded-full bg-foreground/5 px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground ring-1 ring-inset ring-foreground/10"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </SwipeUpModal>
  );
}
