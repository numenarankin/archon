"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportProspectsCsv } from "@/lib/numena/prospect-export";

/**
 * "Export CSV" control for the Filings tab. Takes a user-specified filed-date
 * range and downloads a cold-call CSV — one row per related person, oldest
 * filing first — via the {@link exportProspectsCsv} server action. Dates come
 * from this control's own picker; the current on-screen exemption / industry
 * filters are applied on top.
 */
export function ProspectExport({
  exemption,
  industry,
}: {
  /** Active exemption filter ("all" for any). */
  exemption: string;
  /** Active industry filter ("all" for any). */
  industry: string;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape (mirrors FilingsFilters), but stay open
  // while a run is in flight so progress remains visible.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (busy || enriching) return;
      if (ref.current?.contains(e.target as HTMLElement)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy && !enriching) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, busy, enriching]);

  const canExport = Boolean(from && to) && from <= to && !busy && !enriching;

  const activeFilters = [
    exemption !== "all" ? exemption : null,
    industry !== "all" ? industry : null,
  ].filter(Boolean);

  async function onDownload() {
    if (!canExport) return;
    setBusy(true);
    setError(null);
    try {
      const result = await exportProspectsCsv(from, to, { exemption, industry });
      if (!result.ok) {
        setError(result.error ?? "Export failed.");
        return;
      }
      if (result.rows === 0) {
        setError("No prospects found in that range.");
        return;
      }
      triggerDownload(result.csv, `numena-prospects_${from}_to_${to}.csv`);
      setOpen(false);
    } catch {
      setError("Export failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Download the plain CSV immediately, then run the agent enrichment and
   * download a second, enriched CSV (Company Name / Website / LinkedIn filled).
   * Streams progress from /api/numena/enrich; same rows as the plain file.
   */
  async function onDownloadEnriched() {
    if (!canExport) return;
    setEnriching(true);
    setError(null);
    setNote(null);
    setProgress(null);
    try {
      // 1. Plain CSV first — the reliable artifact if enrichment times out.
      const plain = await exportProspectsCsv(from, to, { exemption, industry });
      if (!plain.ok) {
        setError(plain.error ?? "Export failed.");
        return;
      }
      if (plain.rows === 0) {
        setError("No prospects found in that range.");
        return;
      }
      triggerDownload(plain.csv, `numena-prospects_${from}_to_${to}.csv`);

      // 2. Stream the enrichment, then download the enriched CSV.
      const res = await fetch("/api/numena/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFrom: from,
          dateTo: to,
          filters: { exemption, industry },
        }),
      });
      if (!res.ok || !res.body) {
        const msg = await res.json().catch(() => null);
        setError(msg?.error ?? "Enrichment failed.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const evt = JSON.parse(line) as {
            type: string;
            done?: number;
            total?: number;
            csv?: string;
            error?: string;
            stats?: { confirmed: number; crossRefUpgrades: number };
            truncated?: boolean;
          };
          if (evt.type === "start") {
            setProgress({ done: 0, total: 0 });
          } else if (evt.type === "progress") {
            setProgress({ done: evt.done ?? 0, total: evt.total ?? 0 });
          } else if (evt.type === "done") {
            triggerDownload(
              evt.csv ?? "",
              `numena-prospects_${from}_to_${to}_enriched.csv`
            );
            const filled =
              (evt.stats?.confirmed ?? 0) + (evt.stats?.crossRefUpgrades ?? 0);
            setNote(
              `Enriched ${filled} issuer${filled === 1 ? "" : "s"}.` +
                (evt.truncated ? " Range truncated — narrow it for the rest." : "")
            );
            setProgress(null);
          } else if (evt.type === "error") {
            setError(evt.error ?? "Enrichment failed.");
          }
        }
      }
    } catch {
      setError("Enrichment failed. The plain CSV downloaded; try a smaller range.");
    } finally {
      setEnriching(false);
      setProgress(null);
    }
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="lg"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <DownloadIcon />
        Export
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 flex w-72 flex-col gap-3 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
          <div className="flex flex-col gap-0.5">
            <span className="font-heading text-sm font-semibold">
              Export prospects
            </span>
            <span className="text-xs text-muted-foreground">
              One row per person, oldest filing first. For enrichment outside
              Archon.
            </span>
            {activeFilters.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Applying filters:{" "}
                <span className="font-medium text-foreground">
                  {activeFilters.join(" · ")}
                </span>
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Filed date range
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label="Filed on or after"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className="h-8"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                aria-label="Filed on or before"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="h-8"
              />
            </div>
          </div>

          {progress && (
            <p className="text-xs text-muted-foreground" role="status">
              {progress.total > 0
                ? `Researching issuers… ${progress.done}/${progress.total}`
                : "Preparing enrichment…"}
            </p>
          )}
          {note && !error && (
            <p className="text-xs text-muted-foreground" role="status">
              {note}
            </p>
          )}
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button size="sm" disabled={!canExport} onClick={onDownload}>
              {busy ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  Preparing…
                </>
              ) : (
                <>
                  <DownloadIcon />
                  Download CSV
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canExport}
              onClick={onDownloadEnriched}
            >
              {enriching ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  Enriching…
                </>
              ) : (
                <>
                  <SparklesIcon />
                  Download Enriched
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Turn CSV text into a client-side file download. */
function triggerDownload(csv: string, filename: string) {
  // Prepend a UTF-8 BOM so Excel opens accented names correctly.
  const blob = new Blob(["﻿", csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
