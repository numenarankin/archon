/**
 * Turns a parsed LAS file into a *track plan* for a well-log display: which
 * curves go in which track, with conventional petrophysics colors, scales, and
 * value domains. This is the domain-knowledge layer — pure data, no rendering
 * and no videx import — so it's trivially testable and reusable.
 *
 * The plan follows the standard "triple combo" layout petrophysicists read
 * fluently:
 *   1. Gamma ray / SP / caliper   (lithology + borehole)
 *   2. Resistivity                (LOG scale — hydrocarbons vs. water)
 *   3. Porosity / lithology       (density, neutron, sonic, PEF)
 *   …plus an "Other" track catching anything unrecognized so no curve is lost.
 *
 * Colors are the industry conventions (GR green, resistivity black/red,
 * density red, neutron blue, …) — chosen deliberately over the app's
 * monochrome palette because oil & gas users read logs by curve color.
 */

import type { ParsedLas, LasCurveStats } from "./las";

export type LasScale = "linear" | "log";

export interface LasPlot {
  mnemonic: string;
  unit: string;
  color: string;
  scale: LasScale;
  /** [low, high] value axis; may be descending (e.g. neutron) by convention. */
  domain: [number, number];
  /** Conventionally dashed curves (caliper, density correction). */
  dash?: number[];
}

export interface LasTrack {
  id: string;
  label: string;
  plots: LasPlot[];
}

export interface LasPlan {
  depth: { mnemonic: string; unit: string };
  tracks: LasTrack[];
}

// Conventional petrophysics colors.
const COLOR = {
  gr: "#2e7d32", // gamma ray — green
  sp: "#1a1a1a", // spontaneous potential — near-black
  cali: "#8d6e63", // caliper — brown
  rhob: "#c62828", // bulk density — red
  drho: "#9e9e9e", // density correction — gray
  nphi: "#1565c0", // neutron porosity — blue
  sonic: "#6a1b9a", // sonic — purple
  pef: "#ef6c00", // photoelectric factor — orange
} as const;

// Resistivity curves cycle deep→shallow through these.
const RES_COLORS = ["#111111", "#c62828", "#1565c0", "#00796b"];
// Unrecognized curves cycle through a distinct, readable set.
const OTHER_COLORS = [
  "#00695c", "#4527a0", "#ad1457", "#283593", "#558b2f", "#bf360c",
];

type Category =
  | "gr" | "sp" | "cali"
  | "res"
  | "rhob" | "drho" | "nphi" | "sonic" | "pef"
  | "other";

/** Classify a curve mnemonic into a petrophysical category. */
function classify(mnemonic: string): Category {
  const m = mnemonic.toUpperCase();
  if (/^(GR|SGR|CGR|GRD|GRR|HGR|ECGR|GRGC)/.test(m)) return "gr";
  if (/^SP/.test(m)) return "sp";
  if (/^(CALI|CAL|HCAL|DCAL|CALS|LCAL)/.test(m)) return "cali";
  if (/^(RHOB|RHOZ|ZDEN|DEN)$|^RHO/.test(m)) return "rhob";
  if (/^(DRHO|HDRA|ZCOR)/.test(m)) return "drho";
  if (/^(NPHI|TNPH|NPOR|PHIN|CNC|HNPO|NEU)/.test(m)) return "nphi";
  if (/^(DT|DTC|DTCO|AC|SON|DT4P|DTS)/.test(m)) return "sonic";
  if (/^(PEF|PEFZ|PE)$/.test(m)) return "pef";
  if (
    /(^RT$)|RES|^IL[DM]?$|^LL|MSFL|SFL|^RXO|^AT[0-9]|^RILD|^RILM|^RLA|^M[12]R|RDEP|RMED|RSHA|DEEP|SHAL/.test(m)
  ) {
    return "res";
  }
  return "other";
}

/** A sensible [min,max] for an unrecognized curve, from its parsed stats. */
function statsDomain(stat: LasCurveStats | undefined): [number, number] {
  if (!stat || stat.min === null || stat.max === null || stat.min === stat.max) {
    return [0, 100];
  }
  // Pad ~5% so the curve doesn't ride the track edges.
  const pad = (stat.max - stat.min) * 0.05;
  return [stat.min - pad, stat.max + pad];
}

/**
 * Build the full track plan. Curve index 0 is depth (skipped — it's the shared
 * reference). Empty tracks are dropped.
 */
export function planTracks(parsed: ParsedLas): LasPlan {
  const statByMnem = new Map(parsed.stats.map((s) => [s.mnemonic, s]));

  const gr: LasPlot[] = [];
  const res: LasPlot[] = [];
  const por: LasPlot[] = [];
  const other: LasPlot[] = [];
  let resIdx = 0;
  let otherIdx = 0;

  // Skip column 0 (depth).
  for (let i = 1; i < parsed.curves.length; i++) {
    const c = parsed.curves[i];
    const cat = classify(c.mnemonic);
    const base = { mnemonic: c.mnemonic, unit: c.unit };

    switch (cat) {
      case "gr":
        gr.push({ ...base, color: COLOR.gr, scale: "linear", domain: [0, 150] });
        break;
      case "sp":
        gr.push({ ...base, color: COLOR.sp, scale: "linear", domain: [-160, 40] });
        break;
      case "cali":
        gr.push({ ...base, color: COLOR.cali, scale: "linear", domain: [6, 16], dash: [4, 3] });
        break;
      case "res":
        res.push({
          ...base,
          color: RES_COLORS[resIdx++ % RES_COLORS.length],
          scale: "log",
          domain: [0.2, 2000],
        });
        break;
      case "rhob":
        por.push({ ...base, color: COLOR.rhob, scale: "linear", domain: [1.95, 2.95] });
        break;
      case "drho":
        por.push({ ...base, color: COLOR.drho, scale: "linear", domain: [-0.25, 0.25], dash: [3, 3] });
        break;
      case "nphi":
        // Neutron porosity is shown reversed (high porosity to the left).
        por.push({ ...base, color: COLOR.nphi, scale: "linear", domain: [0.45, -0.15] });
        break;
      case "sonic":
        // Sonic is conventionally reversed (slow at left).
        por.push({ ...base, color: COLOR.sonic, scale: "linear", domain: [140, 40] });
        break;
      case "pef":
        por.push({ ...base, color: COLOR.pef, scale: "linear", domain: [0, 10] });
        break;
      default:
        other.push({
          ...base,
          color: OTHER_COLORS[otherIdx++ % OTHER_COLORS.length],
          scale: "linear",
          domain: statsDomain(statByMnem.get(c.mnemonic)),
        });
    }
  }

  const tracks: LasTrack[] = [];
  if (gr.length) tracks.push({ id: "gr", label: "GR / SP / Caliper", plots: gr });
  if (res.length) tracks.push({ id: "res", label: "Resistivity", plots: res });
  if (por.length) tracks.push({ id: "por", label: "Porosity / Lithology", plots: por });
  if (other.length) tracks.push({ id: "other", label: "Other", plots: other });

  return {
    depth: { mnemonic: parsed.depth.mnemonic, unit: parsed.depth.unit },
    tracks,
  };
}
