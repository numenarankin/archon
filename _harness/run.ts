/**
 * Offline evaluation harness for the enrichment pipeline.
 *
 * Feeds the PLAIN source CSV through the real orchestrator + Deep-Dive Agents
 * and scores the resulting Company Name per issuer against the manual baseline.
 * Deep-Dive calls are cached on disk (ENRICH_CACHE_DIR), so re-runs are free
 * unless the agent prompt changes.
 *
 *   ENRICH_CACHE_DIR=… npx tsx --tsconfig tsconfig.harness.json _harness/run.ts \
 *     "<source.csv>" "<baseline.csv>"
 */
import { readFileSync } from "node:fs";
import { enrichRows } from "@/lib/numena/enrichment/orchestrator";
import {
  issuerKeyOf,
  type BaseRow,
  type ExportData,
  type IssuerGroup,
} from "@/lib/numena/prospect-csv";

const [sourcePath, baselinePath] = process.argv.slice(2);

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

/** Map a header row to column indexes by name (robust to 12- or 13-col files). */
function headerIndex(header: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  header.forEach((h, i) => { idx[h.trim().toLowerCase()] = i; });
  return idx;
}

/** Build ExportData from a plain source CSV (column order located by header). */
function buildExportData(path: string): ExportData {
  const table = parseCsv(readFileSync(path, "utf8"));
  const H = headerIndex(table[0]);
  const col = (name: string) => H[name.toLowerCase()];
  const body = table.slice(1);
  const rows: BaseRow[] = [];
  const groups = new Map<string, IssuerGroup>();
  for (const r of body) {
    const filingDate = r[col("Filing date")] ?? "";
    const listedIssuer = r[col("Listed Issuer")] ?? "";
    const location = r[col("Location")] ?? "";
    const timeZone = r[col("Time Zone")] ?? "";
    const companyPhone = r[col("Company Phone")] ?? "";
    const prospectName = r[col("Prospect Name")] ?? "";
    if (!listedIssuer || !prospectName) continue;
    const key = issuerKeyOf(listedIssuer);
    let g = groups.get(key);
    if (!g) {
      g = { key, listedIssuer, location: location ?? "", phone: companyPhone ?? "", persons: [], rowIndexes: [] };
      groups.set(key, g);
    }
    const idx = rows.length;
    rows.push({
      filingDate: filingDate ?? "", listedIssuer, companyName: "",
      location: location ?? "", timeZone: timeZone ?? "", companyPhone: companyPhone ?? "",
      companyWebsite: "", companyLinkedIn: "", prospectName,
      prospectTitle: "", prospectLinkedIn: "", prospectPhone: "", prospectEmail: "",
      sources: "", issuerKey: key,
    });
    g.rowIndexes.push(idx);
    if (!g.persons.includes(prospectName)) g.persons.push(prospectName);
  }
  return { rows, issuers: [...groups.values()], filings: 0, truncated: false };
}

/** Baseline: Listed Issuer → Company Name (by header), first non-empty. */
function loadBaseline(path: string): Map<string, string> {
  const table = parseCsv(readFileSync(path, "utf8"));
  const H = headerIndex(table[0]);
  const map = new Map<string, string>();
  for (const r of table.slice(1)) {
    const li = (r[H["listed issuer"]] ?? "").trim();
    const cn = (r[H["company name"]] ?? "").trim();
    if (!li) continue;
    const k = issuerKeyOf(li);
    if (!map.has(k) || (!map.get(k) && cn)) map.set(k, cn);
  }
  return map;
}

const LEGAL = new Set(["llc","l.l.c.","lp","l.p.","inc","inc.","ltd","ltd.","corp","corp.","co","co.","company","dst","plc","pllc","lllp","llp","lp\\de"]);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const brandTokens = (s: string) => norm(s).split(" ").filter((t) => t && !LEGAL.has(t));
function brandMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = norm(a), nb = norm(b);
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = brandTokens(a), tb = brandTokens(b);
  if (!ta.length || !tb.length) return false;
  const k = Math.min(2, ta.length, tb.length);
  let lead = true;
  for (let i = 0; i < k; i += 1) if (ta[i] !== tb[i]) lead = false;
  if (lead) return true;
  const short = ta.length <= tb.length ? ta : tb;
  const long = ta.length <= tb.length ? tb : ta;
  return short.every((t, i) => long[i] === t);
}
/** Real corruption only: leaked reasoning, not a legitimately long fund name. */
const isCorrupt = (v: string) =>
  /[<>{}]|https?:\/\/|source:|confirm/i.test(v) || !/^[A-Za-z0-9]/.test(v) ||
  v.replace(/[^A-Za-z]/g, "").length < 3 || v.length > 90;

async function main() {
  const data = buildExportData(sourcePath);
  const baseline = loadBaseline(baselinePath);
  process.stderr.write(`issuers: ${data.issuers.length}, rows: ${data.rows.length}\n`);

  let lastDone = 0;
  const stats = await enrichRows(data, {
    concurrency: 6,
    onProgress: (p) => {
      if (p.done - lastDone >= 5 || p.done === p.total) {
        lastDone = p.done;
        process.stderr.write(`  research ${p.done}/${p.total}\n`);
      }
    },
  });

  const mine = new Map<string, string>();
  for (const g of data.issuers) mine.set(g.key, data.rows[g.rowIndexes[0]].companyName);

  const cats = { match: 0, miss: 0, overResolved: 0, mismatch: 0, tbdOk: 0, corrupt: 0, baseBlank: 0 };
  const missL: string[] = [], mismL: string[] = [], overL: string[] = [], corrL: string[] = [];
  for (const g of data.issuers) {
    const m = mine.get(g.key) ?? "";
    const b = baseline.get(g.key) ?? "";
    const baseSelf = !!b && brandMatch(b, g.listedIssuer);
    if (m && m !== "TBD" && isCorrupt(m)) { cats.corrupt += 1; corrL.push(`${g.listedIssuer} => ${m.slice(0, 50)}`); continue; }
    if (!b) { cats.baseBlank += 1; continue; }
    if (m === "TBD" || !m) {
      if (baseSelf) cats.tbdOk += 1; // neither found a distinct operator — fine
      else { cats.miss += 1; missL.push(`${g.listedIssuer}: mine TBD  base="${b}"`); }
      continue;
    }
    if (brandMatch(m, b)) { cats.match += 1; continue; }
    if (baseSelf && !brandMatch(m, g.listedIssuer)) { cats.overResolved += 1; overL.push(`${g.listedIssuer}: mine="${m}"  (base self-copied)`); }
    else { cats.mismatch += 1; mismL.push(`${g.listedIssuer}: mine="${m}"  base="${b}"`); }
  }

  const scored = data.issuers.length - cats.baseBlank;
  const good = cats.match + cats.overResolved + cats.tbdOk;
  console.log("\n===== SCORE =====");
  console.log(JSON.stringify(stats));
  console.log(`GOOD ${good}/${scored} (${((good / scored) * 100).toFixed(1)}%)  [match ${cats.match} + overResolved ${cats.overResolved} + tbdOk ${cats.tbdOk}]`);
  console.log(`REAL MISS (base resolved, mine TBD): ${cats.miss} | mismatch ${cats.mismatch} | CORRUPT ${cats.corrupt} | base-blank ${cats.baseBlank}`);
  console.log(`\n-- CORRUPT (${corrL.length}) --`); corrL.forEach((x) => console.log("  x " + x));
  console.log(`\n-- REAL MISS: base resolved, mine TBD (${missL.length}) --`); missL.forEach((x) => console.log("  - " + x));
  console.log(`\n-- MISMATCH both-resolved (${mismL.length}) --`); mismL.forEach((x) => console.log("  ~ " + x));
  console.log(`\n-- OVER-RESOLVED (mine found operator, base self-copied) (${overL.length}) --`); overL.forEach((x) => console.log("  + " + x));
}

main().catch((e) => { console.error(e); process.exit(1); });
