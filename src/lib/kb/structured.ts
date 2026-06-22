/**
 * On-demand access to structured data files for Archon's analytic tools. The
 * file in storage / inline `content` is the source of truth; the cached
 * `structured_summary` answers metadata questions, and heavy reads (curve
 * arrays, table columns) re-parse the file here so we never hold raw numbers in
 * the embedding index.
 */

import { hasSupabase } from "@/lib/env";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { parseLas } from "@/lib/kb/parsers/las";

const BUCKET = "files";

/** Read a file's full text (inline content, falling back to OCR'd text). */
async function loadText(fileId: string): Promise<{ name: string; text: string } | null> {
  if (!hasSupabase()) return null;
  const sb = await getSupabaseServer();
  const { data: file } = await sb
    .from("files")
    .select("name, content, derived_content, storage_key")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return null;

  let text = (file.content || file.derived_content || "").trim();
  if (!text && file.storage_key) {
    const { data: blob } = await getSupabaseAdmin().storage
      .from(BUCKET)
      .download(file.storage_key);
    if (blob) text = (await blob.text()).trim();
  }
  return { name: file.name, text };
}

/** The cached parsed summary (header + per-curve/column stats), or null. */
export async function getStructuredSummary(
  fileId: string
): Promise<Record<string, unknown> | null> {
  if (!hasSupabase()) return null;
  const sb = await getSupabaseServer();
  const { data } = await sb
    .from("files")
    .select("structured_summary")
    .eq("id", fileId)
    .maybeSingle();
  return (data?.structured_summary as Record<string, unknown> | null) ?? null;
}

/** Full text of a (prose) file, capped so a tool result stays manageable. */
export async function readFileText(
  fileId: string,
  maxChars = 24000
): Promise<{ name: string; text: string; truncated: boolean } | null> {
  const loaded = await loadText(fileId);
  if (!loaded) return null;
  const truncated = loaded.text.length > maxChars;
  return {
    name: loaded.name,
    text: truncated ? loaded.text.slice(0, maxChars) : loaded.text,
    truncated,
  };
}

export interface CurveSample {
  depth: number;
  value: number;
}

export interface CurveDataResult {
  curve: string;
  unit: string;
  depthMnemonic: string;
  depthUnit: string;
  from: number | null;
  to: number | null;
  count: number;
  /** Decimated samples (depth, value), nulls dropped. */
  samples: CurveSample[];
  decimated: boolean;
}

/**
 * Pull one LAS curve against depth, optionally within a depth window. Samples
 * are decimated to `maxPoints` so a tool call returns a usable series, not tens
 * of thousands of rows.
 */
export async function getCurveData(
  fileId: string,
  curveMnemonic: string,
  depthFrom?: number,
  depthTo?: number,
  maxPoints = 500
): Promise<CurveDataResult | null> {
  const loaded = await loadText(fileId);
  if (!loaded || !loaded.text) return null;

  const las = parseLas(loaded.text, true);
  if (!las.data) return null;

  const depthIdx = 0; // LAS convention: the first curve is the depth index.
  const target = curveMnemonic.trim().toUpperCase();
  const curveIdx = las.curves.findIndex(
    (c) => c.mnemonic.toUpperCase() === target
  );
  if (curveIdx < 0) return null;

  const depthCol = las.data[depthIdx] ?? [];
  const valueCol = las.data[curveIdx] ?? [];

  const pairs: CurveSample[] = [];
  for (let i = 0; i < depthCol.length; i++) {
    const d = depthCol[i];
    const v = valueCol[i];
    if (!Number.isFinite(d) || !Number.isFinite(v)) continue;
    if (depthFrom !== undefined && d < depthFrom) continue;
    if (depthTo !== undefined && d > depthTo) continue;
    pairs.push({ depth: d, value: v });
  }

  const decimated = pairs.length > maxPoints;
  const step = decimated ? Math.ceil(pairs.length / maxPoints) : 1;
  const samples = decimated ? pairs.filter((_, i) => i % step === 0) : pairs;

  const curve = las.curves[curveIdx];
  return {
    curve: curve.mnemonic,
    unit: curve.unit,
    depthMnemonic: las.depth.mnemonic,
    depthUnit: las.depth.unit,
    from: depthFrom ?? null,
    to: depthTo ?? null,
    count: pairs.length,
    samples,
    decimated,
  };
}
