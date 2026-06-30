"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getOperatorsLast12,
  getOperatorsP5,
  type OperatorP5,
} from "@/lib/wells/queries";
import { fmtVol, fmtDate8, fmtPhone, P5_STATUS } from "@/lib/wells/format";
import { toCsv, downloadCsv, slugify, type CsvColumn } from "@/lib/format/csv";

export interface OperatorListItem {
  n: number; // operator number
  nm: string; // name
  a: string; // address line 1
  c: string; // city
  s: string; // state
  z: number; // zip
  w: number; // effective well count shown on the map (active-only when excluded)
  wt: number; // total well count
  wa: number; // active (non-plugged) well count
}

type SortKey = "wells" | "oil" | "gas" | "name";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "wells", label: "Well count" },
  { value: "oil", label: "Oil (12mo)" },
  { value: "gas", label: "Gas (12mo)" },
  { value: "name", label: "Name (A–Z)" },
];

/** Side panel listing the operators inside a clicked cluster. */
export function OperatorListPanel({
  title,
  operators,
  onClose,
  onSelectOperator,
  excludePlugged = false,
}: {
  title: string | null;
  operators: OperatorListItem[];
  onClose: () => void;
  onSelectOperator: (operatorNumber: number) => void;
  excludePlugged?: boolean;
}) {
  const [sort, setSort] = useState<SortKey>("wells");
  const [prod, setProd] = useState<Map<number, { oil: number; gas: number }>>(
    new Map(),
  );
  const [exporting, setExporting] = useState(false);

  // Fetch per-operator last-12 production for this cluster (for oil/gas sorting).
  const ids = operators.map((o) => o.n).join(",");
  useEffect(() => {
    let active = true;
    setProd(new Map());
    if (!operators.length) return;
    getOperatorsLast12(operators.map((o) => o.n))
      .then((m) => {
        if (active) setProd(m);
      })
      .catch(() => {
        /* leave production empty; oil/gas sort just falls back to 0s */
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const sorted = useMemo(() => {
    const oil = (n: number) => prod.get(n)?.oil ?? 0;
    const gas = (n: number) => prod.get(n)?.gas ?? 0;
    const list = [...operators];
    switch (sort) {
      case "name":
        return list.sort((a, b) => (a.nm || "").localeCompare(b.nm || ""));
      case "oil":
        return list.sort((a, b) => oil(b.n) - oil(a.n) || b.w - a.w);
      case "gas":
        return list.sort((a, b) => gas(b.n) - gas(a.n) || b.w - a.w);
      default:
        return list.sort((a, b) => b.w - a.w);
    }
  }, [operators, sort, prod]);

  // Build and download a CSV of the listed operators: identity + mailing address
  // + well counts + last-12mo production (Tier 1, already loaded) plus the P-5
  // master fields (Tier 2, one batched fetch on demand).
  async function handleExport() {
    if (!operators.length || exporting) return;
    setExporting(true);
    try {
      const nums = operators.map((o) => o.n);
      const [p5, prodMap] = await Promise.all([
        getOperatorsP5(nums),
        prod.size ? Promise.resolve(prod) : getOperatorsLast12(nums),
      ]);

      const zip = (o: OperatorListItem, m?: OperatorP5) => {
        const base = m?.zip ?? (o.z || null);
        if (!base) return "";
        return m?.zip_suffix ? `${base}-${m.zip_suffix}` : String(base);
      };

      const cols: CsvColumn<OperatorListItem>[] = [
        { header: "Operator number", value: (o) => o.n },
        { header: "Operator name", value: (o) => o.nm },
        {
          header: "P-5 status",
          value: (o) => {
            const st = p5.get(o.n)?.p5_status;
            return st ? P5_STATUS[st] ?? st : "";
          },
        },
        { header: "Last P-5 date", value: (o) => fmtDate8(p5.get(o.n)?.last_p5_date) ?? "" },
        { header: "Phone", value: (o) => fmtPhone(p5.get(o.n)?.phone) ?? "" },
        { header: "Address 1", value: (o) => p5.get(o.n)?.addr_line1 ?? o.a ?? "" },
        { header: "Address 2", value: (o) => p5.get(o.n)?.addr_line2 ?? "" },
        { header: "City", value: (o) => p5.get(o.n)?.city ?? o.c ?? "" },
        { header: "State", value: (o) => p5.get(o.n)?.state ?? o.s ?? "" },
        { header: "ZIP", value: (o) => zip(o, p5.get(o.n)) },
        { header: "Oil gatherer", value: (o) => p5.get(o.n)?.oil_gatherer ?? "" },
        { header: "Gas gatherer", value: (o) => p5.get(o.n)?.gas_gatherer ?? "" },
        { header: "Wells (total)", value: (o) => o.wt },
        { header: "Wells (active)", value: (o) => o.wa },
        { header: "Oil last 12mo (bbl)", value: (o) => prodMap.get(o.n)?.oil ?? 0 },
        { header: "Gas last 12mo (MCF)", value: (o) => prodMap.get(o.n)?.gas ?? 0 },
      ];

      const csv = toCsv(sorted, cols);
      const base = slugify(title ?? "operators");
      downloadCsv(`${base}${excludePlugged ? "-active-only" : ""}.csv`, csv);
    } catch {
      /* swallow: a failed export should not crash the panel */
    } finally {
      setExporting(false);
    }
  }

  if (title == null) return null;

  return (
    <div className="flex h-full w-[24rem] shrink-0 flex-col overflow-y-auto border-l bg-background shadow-xl">
      <div className="sticky top-0 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div className="truncate font-heading text-lg font-semibold tracking-tight">
            {title}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {operators.length.toLocaleString()} operator
            {operators.length === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={handleExport}
              disabled={exporting || !operators.length}
            >
              <Download className="size-3.5" />
              {exporting ? "Exporting…" : "CSV"}
            </Button>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <ul className="flex flex-col divide-y">
        {sorted.map((o) => (
          <li key={o.n}>
            <button
              onClick={() => onSelectOperator(o.n)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-muted"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-primary">
                  {o.nm || `Operator #${o.n}`}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[o.c, o.s].filter(Boolean).join(", ")}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs text-muted-foreground">
                <span className="block">
                  {o.w.toLocaleString()} {o.w === 1 ? "well" : "wells"}
                </span>
                {sort === "oil" && (
                  <span className="block">{fmtVol(prod.get(o.n)?.oil ?? 0)} bbl</span>
                )}
                {sort === "gas" && (
                  <span className="block">{fmtVol(prod.get(o.n)?.gas ?? 0)} MCF</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
