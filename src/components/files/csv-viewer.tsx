"use client";

// Basic spreadsheet-style viewer for CSV/TSV files: fetches the file text from
// its signed URL, parses it with the shared CSV parser, and renders a scrollable
// table with a sticky header row, a sticky row-number gutter, zebra striping,
// right-aligned numeric columns, and a quick all-columns filter.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2Icon, SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { parseCsv, type ParsedCsv } from "@/lib/kb/parsers/csv";

// Cap rendered rows so a large file can't lock up the DOM; the full row count is
// still shown, and the filter narrows into the rows beyond the cap.
const ROW_CAP = 2000;

// Matches http(s) links and bare www./domain-style URLs and email addresses.
const LINK_RE =
  /(https?:\/\/[^\s]+|www\.[^\s]+|[^\s@]+@[^\s@]+\.[^\s@]+)/gi;

/** Render a cell value, turning any URLs/emails into clickable links. */
function renderCell(value: string): ReactNode {
  if (!value) return "";
  LINK_RE.lastIndex = 0;
  if (!LINK_RE.test(value)) return value;

  LINK_RE.lastIndex = 0;
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = LINK_RE.exec(value)) !== null) {
    if (m.index > last) parts.push(value.slice(last, m.index));
    // Trailing sentence punctuation shouldn't be part of the link.
    const raw = m[0].replace(/[.,;:)\]]+$/, "");
    const trailing = m[0].slice(raw.length);
    const isEmail = raw.includes("@") && !raw.includes("/");
    const href = isEmail
      ? `mailto:${raw}`
      : raw.startsWith("http")
        ? raw
        : `https://${raw}`;
    parts.push(
      <a
        key={key++}
        href={href}
        target={isEmail ? undefined : "_blank"}
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:opacity-80"
        onClick={(e) => e.stopPropagation()}
      >
        {raw}
      </a>,
    );
    if (trailing) parts.push(trailing);
    last = m.index + m[0].length;
  }
  if (last < value.length) parts.push(value.slice(last));
  return parts;
}

/** Spreadsheet column label: 0 -> A, 25 -> Z, 26 -> AA. */
function columnLabel(i: number): string {
  let n = i;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function CsvViewer({ url, name }: { url: string; name: string }) {
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      setParsed(null);
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`Could not fetch file (HTTP ${r.status}).`);
        const text = await r.text();
        if (active) {
          setParsed(parseCsv(text, true));
          setLoading(false);
        }
      } catch (e: unknown) {
        if (active) {
          setError(e instanceof Error ? e.message : "Could not load this file.");
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [url]);

  const headers = parsed?.headers ?? [];
  const numeric = useMemo(
    () => (parsed?.columns ?? []).map((c) => c.numeric),
    [parsed],
  );
  const rows = useMemo(() => parsed?.rows ?? [], [parsed]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.some((c) => c.toLowerCase().includes(q)));
  }, [rows, query]);

  const shown = filtered.slice(0, ROW_CAP);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }
  if (headers.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        This file is empty.
      </div>
    );
  }

  const thBase =
    "border-b border-r border-border bg-muted/60 px-2.5 py-1.5 text-left font-medium text-foreground/80";
  const tdBase = "border-b border-r border-border px-2.5 py-1 align-top";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter rows…"
            className="h-8 w-56 pl-7"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length.toLocaleString()}
          {query ? ` of ${rows.length.toLocaleString()}` : ""} rows ·{" "}
          {headers.length} columns
          {shown.length < filtered.length
            ? ` · showing first ${ROW_CAP.toLocaleString()}`
            : ""}
        </span>
        <span className="ml-auto truncate text-xs text-muted-foreground">{name}</span>
      </div>

      {/* Sheet */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-collapse text-sm tabular-nums">
          <thead className="sticky top-0 z-20">
            {/* Spreadsheet column letters */}
            <tr>
              <th className="sticky left-0 z-30 border-b border-r border-border bg-muted px-2 py-0.5 text-[10px] font-normal text-muted-foreground" />
              {headers.map((_, ci) => (
                <th
                  key={ci}
                  className="border-b border-r border-border bg-muted px-2.5 py-0.5 text-center text-[10px] font-normal text-muted-foreground"
                >
                  {columnLabel(ci)}
                </th>
              ))}
            </tr>
            {/* Header names */}
            <tr>
              <th className="sticky left-0 z-30 border-b border-r border-border bg-muted/60 px-2 py-1.5 text-[11px] font-normal text-muted-foreground">
                #
              </th>
              {headers.map((h, ci) => (
                <th
                  key={ci}
                  className={`${thBase} ${numeric[ci] ? "text-right" : ""} whitespace-nowrap`}
                >
                  {h || <span className="text-muted-foreground">(unnamed)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, ri) => (
              <tr key={ri} className="bg-background even:bg-muted/20 hover:bg-accent/40">
                <td className="sticky left-0 z-10 border-b border-r border-border bg-muted/40 px-2 py-1 text-right text-[11px] text-muted-foreground">
                  {ri + 1}
                </td>
                {headers.map((_, ci) => (
                  <td
                    key={ci}
                    className={`${tdBase} ${numeric[ci] ? "text-right" : ""} max-w-xs truncate`}
                    title={row[ci] ?? ""}
                  >
                    {renderCell(row[ci] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No rows match “{query}”.
          </div>
        )}
      </div>
    </div>
  );
}
