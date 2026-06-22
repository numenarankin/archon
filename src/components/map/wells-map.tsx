"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { WellDetailPanel } from "./well-detail-panel";
import { OperatorDetailPanel } from "./operator-detail-panel";
import { PrincipalDetailPanel } from "./principal-detail-panel";
import { OperatorListPanel, type OperatorListItem } from "./operator-list-panel";
import { MapFilters, DEFAULT_FILTERS, type Filters } from "./map-filters";
import { useMapAiContext } from "@/lib/ai/map-context";
import { COUNTY_NAMES } from "@/lib/wells/counties";
import { getFocusWells, loadOperatorPoints } from "@/lib/wells/queries";

const FOCUS_SOURCE = "focus-src";
const OPERATOR_SOURCE = "operator-src";
const PMTILES_LAYERS = ["clusters", "cluster-count", "wells"];
const FOCUS_LAYERS = ["focus-clusters", "focus-cluster-count", "focus-wells"];
const OPERATOR_LAYERS = ["op-clusters", "op-cluster-count", "op-points"];
const WELL_LAYERS = [...PMTILES_LAYERS, ...FOCUS_LAYERS];

const SOURCE_ID = "wells-src";
const SOURCE_LAYER = "wells";
const TEXAS_BOUNDS: mapboxgl.LngLatBoundsLike = [
  [-106.9, 25.5],
  [-93.2, 36.7],
];

// Minimal shape of a clicked tile feature (avoids the @types/geojson namespace).
interface ClickedFeature {
  geometry: { type: string; coordinates: [number, number] };
  properties: Record<string, string | number | boolean> | null;
}

type Expr = mapboxgl.ExpressionSpecification;
const baseRadius: Expr = [
  "interpolate",
  ["linear"],
  ["zoom"],
  6,
  2,
  13,
  5,
] as unknown as Expr;

// Color individual wells by oil/gas; shared by the tile + focus layers.
const wellColor: Expr = [
  "match",
  ["get", "og"],
  "O",
  "#16a34a",
  "G",
  "#dc2626",
  "#9ca3af",
] as unknown as Expr;

/**
 * Filter for the tile-based individual-well layer (broad category filters only).
 * County and operator are NOT here — those switch the map to the Supabase-backed
 * focus layer so it shows ONLY the matching wells (see the focus effect).
 */
function wellsFilter(f: Filters): mapboxgl.FilterSpecification {
  const parts: unknown[] = ["all", ["!", ["has", "point_count"]]];
  if (f.oilGas !== "all") parts.push(["==", ["get", "og"], f.oilGas]);
  if (f.plugged === "plugged") parts.push(["==", ["get", "plug"], 1]);
  if (f.plugged === "active") parts.push(["==", ["get", "plug"], 0]);
  if (f.district !== "all") parts.push(["==", ["get", "dist"], f.district]);
  return parts as unknown as mapboxgl.FilterSpecification;
}

export function WellsMap() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedApi, setSelectedApi] = useState<number | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<number | null>(null);
  const [selectedPrincipal, setSelectedPrincipal] = useState<string | null>(null);
  const [operatorList, setOperatorList] = useState<{
    title: string;
    items: OperatorListItem[];
  } | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const prevModeRef = useRef<"wells" | "operators">("wells");

  // Selecting a well from the operator panel jumps the map + well detail to it.
  const handleSelectWell = (api: number, lng: number | null, lat: number | null) => {
    setSelectedApi(api);
    if (lng != null && lat != null && mapRef.current) {
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: Math.max(mapRef.current.getZoom(), 11),
      });
    }
  };

  // Initialize the map once.
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      bounds: TEXAS_BOUNDS,
      fitBoundsOptions: { padding: 24 },
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      try {
      map.addSource(SOURCE_ID, {
        type: "vector",
        tiles: [`${window.location.origin}/api/tiles/{z}/{x}/{y}`],
        minzoom: 0,
        maxzoom: 13,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE_ID,
        "source-layer": SOURCE_LAYER,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#93c5fd",
            100,
            "#60a5fa",
            1000,
            "#3b82f6",
            10000,
            "#1d4ed8",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            12,
            100,
            16,
            1000,
            22,
            10000,
            30,
          ],
          "circle-opacity": 0.85,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      } as unknown as mapboxgl.LayerSpecification);

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE_ID,
        "source-layer": SOURCE_LAYER,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      } as unknown as mapboxgl.LayerSpecification);

      map.addLayer({
        id: "wells",
        type: "circle",
        source: SOURCE_ID,
        "source-layer": SOURCE_LAYER,
        filter: wellsFilter(DEFAULT_FILTERS),
        paint: {
          "circle-color": [
            "match",
            ["get", "og"],
            "O",
            "#16a34a",
            "G",
            "#dc2626",
            "#9ca3af",
          ],
          "circle-radius": baseRadius,
          "circle-stroke-width": 0,
          "circle-stroke-color": "#f59e0b",
          "circle-opacity": 0.9,
        },
      } as unknown as mapboxgl.LayerSpecification);

      // Focus layer: a Supabase-backed GeoJSON source, natively clustered, that
      // shows ONLY the wells matching a county/operator search. Hidden until a
      // narrow search is active.
      map.addSource(FOCUS_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 13,
      } as unknown as mapboxgl.SourceSpecification);

      map.addLayer({
        id: "focus-clusters",
        type: "circle",
        source: FOCUS_SOURCE,
        filter: ["has", "point_count"],
        layout: { visibility: "none" },
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#93c5fd",
            100,
            "#60a5fa",
            1000,
            "#3b82f6",
            10000,
            "#1d4ed8",
          ],
          "circle-radius": ["step", ["get", "point_count"], 12, 100, 16, 1000, 22, 10000, 30],
          "circle-opacity": 0.85,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      } as unknown as mapboxgl.LayerSpecification);

      map.addLayer({
        id: "focus-cluster-count",
        type: "symbol",
        source: FOCUS_SOURCE,
        filter: ["has", "point_count"],
        layout: {
          visibility: "none",
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      } as unknown as mapboxgl.LayerSpecification);

      map.addLayer({
        id: "focus-wells",
        type: "circle",
        source: FOCUS_SOURCE,
        filter: ["!", ["has", "point_count"]],
        layout: { visibility: "none" },
        paint: {
          "circle-color": wellColor,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3, 13, 6],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.95,
        },
      } as unknown as mapboxgl.LayerSpecification);

      // Operator mode: operators placed at their mailing-ZIP centroid, natively
      // clustered (many share a ZIP). Violet to distinguish from the wells.
      map.addSource(OPERATOR_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 45,
        clusterMaxZoom: 11,
      } as unknown as mapboxgl.SourceSpecification);

      map.addLayer({
        id: "op-clusters",
        type: "circle",
        source: OPERATOR_SOURCE,
        filter: ["has", "point_count"],
        layout: { visibility: "none" },
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#c4b5fd",
            50,
            "#a78bfa",
            200,
            "#8b5cf6",
            1000,
            "#6d28d9",
          ],
          "circle-radius": ["step", ["get", "point_count"], 14, 50, 18, 200, 24, 1000, 32],
          "circle-opacity": 0.85,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      } as unknown as mapboxgl.LayerSpecification);

      map.addLayer({
        id: "op-cluster-count",
        type: "symbol",
        source: OPERATOR_SOURCE,
        filter: ["has", "point_count"],
        layout: {
          visibility: "none",
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      } as unknown as mapboxgl.LayerSpecification);

      map.addLayer({
        id: "op-points",
        type: "circle",
        source: OPERATOR_SOURCE,
        filter: ["!", ["has", "point_count"]],
        layout: { visibility: "none" },
        paint: {
          "circle-color": "#7c3aed",
          "circle-radius": ["interpolate", ["linear"], ["get", "w"], 1, 4, 50, 8, 500, 13, 5000, 20],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.9,
        },
      } as unknown as mapboxgl.LayerSpecification);
      } catch (err) {
        console.error("map layer setup failed", err);
      }

      setReady(true);
    });

    const onClusterClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const feat = e.features?.[0] as unknown as ClickedFeature | undefined;
      if (!feat || feat.geometry.type !== "Point") return;
      map.easeTo({
        center: feat.geometry.coordinates as [number, number],
        zoom: Math.min(map.getZoom() + 2.5, 14),
      });
    };
    const onWellClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const feat = e.features?.[0] as unknown as ClickedFeature | undefined;
      if (!feat?.properties) return;
      setSelectedApi(Number(feat.properties.api));
    };
    const onOpPointClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const feat = e.features?.[0] as unknown as ClickedFeature | undefined;
      if (!feat?.properties) return;
      setSelectedOperator(Number(feat.properties.n));
    };
    const onOpClusterClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const feat = e.features?.[0] as unknown as ClickedFeature | undefined;
      if (!feat?.properties) return;
      const clusterId = feat.properties.cluster_id as number;
      const src = map.getSource(OPERATOR_SOURCE) as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      src.getClusterLeaves(clusterId, 1000, 0, (err, leaves) => {
        if (err || !leaves) return;
        const items: OperatorListItem[] = leaves.map((l) => {
          const p = (l.properties ?? {}) as Record<string, unknown>;
          return {
            n: Number(p.n),
            nm: String(p.nm ?? ""),
            c: String(p.c ?? ""),
            s: String(p.s ?? ""),
            w: Number(p.w ?? 0),
          };
        });
        const first = items[0];
        const title =
          first && (first.c || first.s)
            ? `Operators near ${[first.c, first.s].filter(Boolean).join(", ")}`
            : "Operators";
        setOperatorList({ title, items });
      });
    };
    const cursorOn = () => (map.getCanvas().style.cursor = "pointer");
    const cursorOff = () => (map.getCanvas().style.cursor = "");

    // Operator address popup on hover.
    const opPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
    });
    const onOpEnter = (e: mapboxgl.MapLayerMouseEvent) => {
      const feat = e.features?.[0] as unknown as ClickedFeature | undefined;
      if (!feat?.properties) return;
      const p = feat.properties;
      const el = document.createElement("div");
      el.style.whiteSpace = "pre-line";
      el.style.fontSize = "12px";
      el.style.lineHeight = "1.35";
      el.innerText = [
        String(p.nm),
        p.a ? String(p.a) : "",
        [p.c, p.s, p.z].filter(Boolean).map(String).join(" "),
        `${p.w} wells operated`,
      ]
        .filter(Boolean)
        .join("\n");
      opPopup.setLngLat(feat.geometry.coordinates as [number, number]).setDOMContent(el).addTo(map);
    };
    const onOpLeave = () => opPopup.remove();

    map.on("click", "clusters", onClusterClick);
    map.on("click", "wells", onWellClick);
    map.on("click", "focus-clusters", onClusterClick);
    map.on("click", "focus-wells", onWellClick);
    map.on("click", "op-clusters", onOpClusterClick);
    map.on("click", "op-points", onOpPointClick);
    for (const id of [
      "clusters",
      "wells",
      "focus-clusters",
      "focus-wells",
      "op-clusters",
      "op-points",
    ]) {
      map.on("mouseenter", id, cursorOn);
      map.on("mouseleave", id, cursorOff);
    }
    map.on("mouseenter", "op-points", onOpEnter);
    map.on("mouseleave", "op-points", onOpLeave);

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
      useMapAiContext.getState().setWell(null);
      useMapAiContext.getState().setFilters(null);
    };
  }, [token]);

  // Publish the active filters to the assistant's map context.
  useEffect(() => {
    useMapAiContext.getState().setFilters({
      oilGas:
        filters.oilGas === "all" ? "all" : filters.oilGas === "O" ? "Oil" : "Gas",
      status: filters.plugged,
      district: filters.district === "all" ? "all" : String(filters.district),
      county:
        filters.county === "all"
          ? "all"
          : COUNTY_NAMES[filters.county] ?? String(filters.county),
      operator: filters.operator?.operator_name ?? null,
    });
  }, [filters]);

  // Narrow searches (county / operator) switch to the Supabase-backed focus
  // layer that shows ONLY those wells (natively clustered) and zooms to them.
  // Broad category filters (oil/gas, status, district) apply to the tile layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const setVis = (ids: string[], v: "visible" | "none") =>
      ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", v));

    // OPERATOR MODE: operators placed by mailing ZIP, clustered, filtered by
    // well count. Click a point -> profile; click a cluster -> operator list.
    if (filters.mode === "operators") {
      setVis(WELL_LAYERS, "none");
      setVis(OPERATOR_LAYERS, "visible");
      const entering = prevModeRef.current !== "operators";
      prevModeRef.current = "operators";
      let cancelled = false;
      loadOperatorPoints()
        .then((all) => {
          if (cancelled || !mapRef.current) return;
          const src = map.getSource(OPERATOR_SOURCE) as mapboxgl.GeoJSONSource | undefined;
          if (!src) return;
          const lo = filters.minWells ?? 0;
          const hi = filters.maxWells ?? Infinity;
          const pts = all.filter((o) => o.w >= lo && o.w <= hi);
          src.setData({
            type: "FeatureCollection" as const,
            features: pts.map((o) => ({
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: [o.lng, o.lat] },
              properties: { n: o.n, nm: o.nm, a: o.a, c: o.c, s: o.s, z: o.z, w: o.w },
            })),
          });
          if (entering) map.fitBounds(TEXAS_BOUNDS, { padding: 24, duration: 600 });
        })
        .catch((err) => console.error("operator load failed", err));
      return () => {
        cancelled = true;
      };
    }

    // WELLS MODE
    prevModeRef.current = "wells";
    setVis(OPERATOR_LAYERS, "none");
    const focusSrc = () => map.getSource(FOCUS_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    const focusActive = filters.operator != null || filters.county !== "all";
    if (!focusActive) {
      map.setFilter("wells", wellsFilter(filters));
      setVis(FOCUS_LAYERS, "none");
      setVis(PMTILES_LAYERS, "visible");
      focusSrc()?.setData({ type: "FeatureCollection" as const, features: [] });
      return;
    }

    // Switch to focus mode IMMEDIATELY (hide the full map / clear the busy
    // background) so the only wells shown are the search result, even before
    // the query returns. The focus source then fills in.
    setVis(PMTILES_LAYERS, "none");
    setVis(FOCUS_LAYERS, "visible");
    focusSrc()?.setData({ type: "FeatureCollection" as const, features: [] });

    let cancelled = false;
    getFocusWells({
      operatorNumber: filters.operator?.operator_number ?? null,
      countyCode: filters.county === "all" ? null : filters.county,
      oilGas: filters.oilGas === "all" ? null : filters.oilGas,
      plugged: filters.plugged === "all" ? null : filters.plugged === "plugged",
      district: filters.district === "all" ? null : filters.district,
    })
      .then(({ wells }) => {
        if (cancelled || !mapRef.current) return;
        const src = focusSrc();
        if (!src) return;
        src.setData({
          type: "FeatureCollection" as const,
          features: wells.map((w) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [w.lng, w.lat] },
            properties: { api: w.api, og: w.og },
          })),
        });
        if (wells.length) {
          const b = new mapboxgl.LngLatBounds();
          for (const w of wells) b.extend([w.lng, w.lat] as [number, number]);
          map.fitBounds(b, { padding: 60, maxZoom: 13, duration: 800 });
        }
      })
      .catch((err) => {
        console.error("focus query failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, ready]);

  if (!token) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="max-w-md rounded-lg border bg-muted/30 p-6 text-center">
          <h2 className="font-heading text-lg font-semibold">Mapbox token needed</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Set <code className="font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</code> in
            <code className="font-mono"> .env.local</code> (a public,
            URL-restricted token) and reload to view the well map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <MapFilters
        filters={filters}
        onChange={(f) => {
          if (f.mode !== filters.mode) {
            setOperatorList(null);
            setSelectedApi(null);
          }
          setFilters(f);
        }}
      />
      <div className="absolute right-0 top-0 z-10 flex h-full">
        <WellDetailPanel
          api={selectedApi}
          onClose={() => setSelectedApi(null)}
          onSelectOperator={setSelectedOperator}
          onSelectPrincipal={setSelectedPrincipal}
        />
        {operatorList && (
          <OperatorListPanel
            title={operatorList.title}
            operators={operatorList.items}
            onClose={() => setOperatorList(null)}
            onSelectOperator={setSelectedOperator}
          />
        )}
        <OperatorDetailPanel
          operatorNumber={selectedOperator}
          onClose={() => setSelectedOperator(null)}
          onSelectWell={handleSelectWell}
          onSelectPrincipal={setSelectedPrincipal}
        />
        <PrincipalDetailPanel
          name={selectedPrincipal}
          onClose={() => setSelectedPrincipal(null)}
          onSelectOperator={setSelectedOperator}
        />
      </div>
    </div>
  );
}
