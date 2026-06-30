"use client";

import { useEffect, useState } from "react";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { getBdProfile } from "@/lib/numena/bd-actions";
import type { BdProfile } from "@/lib/numena/prospecting";

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("en-US");

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

function pct(value: number | null): string {
  return value == null ? "—" : `${value}%`;
}

function signedPct(value: number | null): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value}%`;
}

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/);
  if (words.length === 0 || words[0] === "") return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-foreground/10">
      {children}
    </span>
  );
}

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h3>
  );
}

interface BdProfileModalProps {
  open: boolean;
  firmId: string | null;
  firmName: string;
  onClose: () => void;
}

export function BdProfileModal({
  open,
  firmId,
  firmName,
  onClose,
}: BdProfileModalProps) {
  const [result, setResult] = useState<{
    firmId: string;
    profile: BdProfile | null;
  } | null>(null);

  useEffect(() => {
    if (!open || !firmId) return;
    let cancelled = false;
    getBdProfile(firmId)
      .then((data) => {
        if (!cancelled) setResult({ firmId, profile: data });
      })
      .catch(() => {
        if (!cancelled) setResult({ firmId, profile: null });
      });
    return () => {
      cancelled = true;
    };
  }, [open, firmId]);

  const current = result && result.firmId === firmId ? result : null;
  const profile = current?.profile ?? null;
  const status: "idle" | "loading" | "error" =
    current == null ? "loading" : current.profile == null ? "error" : "idle";

  return (
    <SwipeUpModal
      open={open}
      onClose={onClose}
      title={profile?.name ?? firmName}
      description={
        profile
          ? [profile.segment, profile.location].filter(Boolean).join(" · ") ||
            undefined
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
            Couldn&apos;t load this firm&apos;s details.
          </p>
        )}

        {profile && status === "idle" && (
          <>
            {/* Identity strip: monogram + registration + CRD. */}
            <div className="flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary font-heading text-lg font-bold text-primary-foreground ring-1 ring-foreground/10">
                {initials(profile.name)}
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap gap-1.5">
                  {profile.segment && <Pill>{profile.segment}</Pill>}
                  {profile.bdScope && <Pill>BD {profile.bdScope}</Pill>}
                  {profile.iaScope && <Pill>IA {profile.iaScope}</Pill>}
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  CRD {text(profile.crd)}
                  {profile.finraFetchedAt
                    ? ` · FINRA as of ${date(profile.finraFetchedAt)}`
                    : ""}
                </span>
              </div>
            </div>

            {/* Hero: trailing deal activity. */}
            <div className="rounded-2xl border bg-muted/30 p-5">
              <div className="font-mono text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground">
                Deals · trailing 24 months
              </div>
              <div className="mt-1 font-heading text-4xl font-bold tabular-nums leading-none">
                {numberFormatter.format(profile.deals24mo)}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium text-muted-foreground tabular-nums">
                <span>{numberFormatter.format(profile.deals90d)} in last 90d</span>
                <span>{signedPct(profile.momentumPct)} momentum</span>
                <span>{compactMoney(profile.capitalPlaced24mo)} placed</span>
              </div>
            </div>

            {/* Quick stats. */}
            <div className="grid grid-cols-3 gap-2">
              <Stat
                label="506(c) 24mo"
                value={numberFormatter.format(profile.deals506c24mo)}
              />
              <Stat label="506(c) Share" value={pct(profile.share506cPct)} />
              <Stat
                label="Cap 90d"
                value={compactMoney(profile.capitalPlaced90d)}
              />
              <Stat label="Last Deal" value={date(profile.lastDealAt)} />
              <Stat
                label="Disclosures"
                value={
                  profile.disclosures == null
                    ? "—"
                    : numberFormatter.format(profile.disclosures)
                }
              />
              <Stat
                label="Branches"
                value={
                  profile.branches == null
                    ? "—"
                    : numberFormatter.format(profile.branches)
                }
              />
            </div>

            {/* Industries. */}
            {profile.industries.length > 0 && (
              <div>
                <SectionTitle>Industries · {profile.industries.length}</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {profile.industries.map((ind) => (
                    <Pill key={ind}>{ind}</Pill>
                  ))}
                </div>
              </div>
            )}

            {/* Recent deals. */}
            <div>
              <SectionTitle>Recent deals</SectionTitle>
              {profile.recentDeals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent deals on record.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {profile.recentDeals.map((d) => (
                    <div
                      key={d.accessionNo}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">
                          {d.issuer}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {date(d.filedAt)} · {d.exemption}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                        {compactMoney(d.offeringAmount)}
                      </span>
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
