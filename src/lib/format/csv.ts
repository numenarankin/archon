// Minimal CSV writer: builds an RFC-4180-style CSV string from typed rows and
// triggers a browser download. Keep the string builder pure so it stays testable;
// the download helper is the only browser-only piece.

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/** Quote a field when it contains a comma, quote, or newline; double inner quotes. */
function escapeCsv(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string: a header row followed by one row per item. */
export function toCsv<T>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
): string {
  const head = columns.map((c) => escapeCsv(c.header)).join(",");
  const body = rows.map((r) =>
    columns.map((c) => escapeCsv(c.value(r))).join(","),
  );
  return [head, ...body].join("\r\n");
}

/** Turn a label into a safe, lowercase, hyphenated file slug. */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export"
  );
}

/** Trigger a client-side download of `content` as a UTF-8 file. */
export function downloadCsv(filename: string, content: string): void {
  // Prepend a BOM so Excel reads UTF-8 correctly.
  const blob = new Blob(["﻿", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
