"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon } from "lucide-react";
// videx lays the log out by adding `.log-controller` flex classes to our
// container — its track sizing lives entirely in this stylesheet. Without it
// every track collapses to zero size and nothing renders.
import "@equinor/videx-wellog/dist/styles/styles.css";
import { parseLas, type ParsedLas } from "@/lib/kb/parsers/las";
import { planTracks } from "@/lib/kb/parsers/las-tracks";

interface LasPreviewProps {
  /** Signed URL to the raw .las text. */
  url: string;
  name: string;
}

type SeriesMap = Record<string, [number, number][]>;

/**
 * Well-log viewer for LAS files. Renders the industry-standard track display
 * (depth-vertical, multi-track "triple combo") via @equinor/videx-wellog, with
 * conventional petrophysics curve colors. The library is loaded lazily inside
 * an effect — it touches the DOM (d3-selection) and must never run on the
 * server, and this keeps it out of the initial bundle.
 *
 * The chrome (toolbar, metadata, layout) uses the app's design tokens; the log
 * plot itself sits on a white field, the convention for reading logs (and
 * consistent with how PDFs/images preview on a neutral backdrop here).
 */
export function LasPreview({ url, name }: LasPreviewProps) {
  const [parsed, setParsed] = useState<ParsedLas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<import("@equinor/videx-wellog").LogViewer | null>(null);

  // Fetch + parse the LAS text. The component is keyed by `url` upstream, so it
  // mounts fresh per file — no need to reset state synchronously here.
  useEffect(() => {
    let active = true;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
        return res.text();
      })
      .then((text) => {
        if (!active) return;
        const result = parseLas(text, true);
        if (!result.data || result.data.length < 2 || result.rowCount === 0) {
          throw new Error("This LAS file has no curve data to plot.");
        }
        setParsed(result);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Couldn't read this LAS file.");
      });
    return () => {
      active = false;
    };
  }, [url]);

  // Render the log once parsed and the container is mounted.
  useEffect(() => {
    const el = containerRef.current;
    if (!parsed || !el) return;
    let disposed = false;

    (async () => {
      // Import the real ESM build directly — the bare specifier resolves to a
      // mis-packaged CJS `main` whose exports break under the bundler. See
      // src/types/videx-wellog.d.ts.
      const wellog = await import("@equinor/videx-wellog/dist/index.esm.js");
      if (disposed || !containerRef.current) return;
      const { LogViewer, ScaleTrack, GraphTrack, graphLegendConfig, scaleLegendConfig } =
        wellog;

      const data = parsed.data!;
      const depthCol = data[0];

      // Column-major curve data → per-mnemonic [depth, value] tuples.
      const seriesMap: SeriesMap = {};
      const plan = planTracks(parsed);
      const idxByMnem = new Map(parsed.curves.map((c, i) => [c.mnemonic, i]));
      for (const track of plan.tracks) {
        for (const plot of track.plots) {
          const idx = idxByMnem.get(plot.mnemonic);
          if (idx == null) continue;
          const col = data[idx];
          const series: [number, number][] = [];
          for (let r = 0; r < depthCol.length; r++) {
            const d = depthCol[r];
            if (Number.isFinite(d)) series.push([d, col[r]]);
          }
          seriesMap[plot.mnemonic] = series;
        }
      }

      // Depth domain: prefer the declared range, else the data extents.
      let lo = parsed.depth.start;
      let hi = parsed.depth.stop;
      if (lo == null || hi == null) {
        const finite = depthCol.filter((d) => Number.isFinite(d));
        lo = finite[0] ?? 0;
        hi = finite[finite.length - 1] ?? depthCol.length;
      }
      const domain: [number, number] = [Math.min(lo, hi), Math.max(lo, hi)];

      const scaleTrack = new ScaleTrack("depth", {
        label: parsed.depth.mnemonic,
        units: parsed.depth.unit,
        legendConfig: scaleLegendConfig,
        width: 2,
      });

      const graphTracks = plan.tracks.map((track) => {
        const plots = track.plots.map((p) => ({
          id: p.mnemonic,
          type: "line",
          options: {
            scale: p.scale,
            domain: p.domain,
            color: p.color,
            width: 1,
            dash: p.dash,
            // NaN marks LAS null values — break the line there.
            defined: (v: number) => Number.isFinite(v),
            dataAccessor: (d: SeriesMap) => d[p.mnemonic] ?? [],
            // Read at runtime by graphLegendConfig (not in the lib's typings).
            legendInfo: () => ({ label: p.mnemonic, unit: p.unit }),
          },
        }));
        // Single localized cast: our plot options include `legendInfo`, which is
        // honored at runtime but absent from the published plot-option types.
        return new GraphTrack(track.id, {
          label: track.label,
          legendConfig: graphLegendConfig,
          data: seriesMap,
          plots,
          width: Math.max(2, track.plots.length),
        } as unknown as ConstructorParameters<typeof GraphTrack>[1]);
      });

      const viewer = new LogViewer({
        showLegend: true,
        showTitles: true,
        domain,
        autoResize: true,
      });
      el.replaceChildren();
      viewer.init(el);
      viewer.setTracks([scaleTrack, ...graphTracks]);
      viewerRef.current = viewer;
    })();

    return () => {
      disposed = true;
      // Disconnect videx's ResizeObserver before tearing down the DOM, else it
      // keeps firing against a detached container (StrictMode double-mounts).
      viewerRef.current?.onUnmount();
      viewerRef.current = null;
      el.replaceChildren();
    };
  }, [parsed]);

  if (error) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <Toolbar name={name} subtitle="LAS well log" />
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-tertiary-text">
          {error}
        </div>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <Toolbar name={name} subtitle="LAS well log" />
        <div className="flex flex-1 items-center justify-center text-tertiary-text">
          <Loader2Icon className="size-5 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar name={name} subtitle="LAS well log" />
      <MetaBar parsed={parsed} />
      {/* Log plot on a white field — the convention for reading well logs. */}
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden bg-white" />
    </div>
  );
}

function Toolbar({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background-surface px-3 py-1.5">
      <span className="ty-caption truncate font-medium text-secondary-text">
        {name}
      </span>
      <span className="ty-caption font-mono text-tertiary-text">{subtitle}</span>
    </div>
  );
}

function MetaBar({ parsed }: { parsed: ParsedLas }) {
  const items: Array<[string, string]> = [];
  const well = parsed.well.WELL ?? parsed.well.WELLNAME;
  const field = parsed.well.FLD ?? parsed.well.FIELD;
  const api = parsed.well.API ?? parsed.well.UWI;
  if (well) items.push(["Well", well]);
  if (field) items.push(["Field", field]);
  if (api) items.push(["API/UWI", api]);
  if (parsed.depth.start != null && parsed.depth.stop != null) {
    items.push([
      "Interval",
      `${parsed.depth.start}–${parsed.depth.stop} ${parsed.depth.unit}`.trim(),
    ]);
  }
  items.push(["Curves", String(Math.max(0, parsed.curves.length - 1))]);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-b border-border bg-background-subtle px-3 py-1.5">
      {items.map(([label, value]) => (
        <span key={label} className="ty-caption text-tertiary-text">
          <span className="text-tertiary-text/70">{label}: </span>
          <span className="font-medium text-secondary-text">{value}</span>
        </span>
      ))}
    </div>
  );
}
