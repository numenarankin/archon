# Plan: `/map` page — every Texas well, clustered, click for well + operator detail

## Goal

A `/map` route in `wildcat-superapp` that renders all ~961k geocoded RRC
wellbores on a Mapbox GL map, **clustered** at low zoom and resolving to
individual wells as you zoom in. Clicking a well opens a detail panel showing
the well facts **and its operator's full P-5 profile (name, status, address,
officers)**. Category and operator filtering on top.

## What changed since the first draft

1. **Supabase is now the system of record.** All RRC data (wells, segments,
   permits, operators, officers, and the derived link tables) is loaded into
   Supabase Postgres/PostGIS, so the deployed app queries it directly. (The
   DuckDB/Parquet pipeline stays as the ETL + analytics layer that *produces*
   what gets loaded.)
2. **Operator data now exists and is linked.** `well_operator_detail` and
   `operator_officers` give a click-a-well operator profile. The panel is a
   first-class feature, not an optional add-on.
3. **Clustering confirmed** as the desired UX.

## The core constraint (unchanged)

Mapbox renders millions of points fine on the GPU; the bottleneck is delivery.
Shipping ~961k points as one GeoJSON (~150 MB) and clustering in JS does not
scale. Fix: **vector tiles** (PMTiles) so the browser only downloads/renders
what is on screen, with clustering baked in at build time.

## Architecture

**Supabase (system of record) + static PMTiles for the clustered dots + Mapbox
GL rendering. Click fetches well + operator + officers from Supabase.**

```
DuckDB/Parquet (ETL)  ──load──►  Supabase (Postgres/PostGIS)  ◄── app queries
   well_summary, well_location,                 │  wells, well_operator_detail,
   permits, operators, operator_officers,       │  operator_officers, segments…
   well_operator(_detail), 28 segments          │
        │                                        │
        │ export points (+operator_number)       │  click a well by api_number ►
        ▼                                        │  well facts + operator profile
   wells.geojson ──tippecanoe──► wells.pmtiles   │  + officers + formations/plugging
        │  (clusters precomputed, ~10-30 MB)     │
        ▼                                        ▼
   /map → mapbox-gl + pmtiles ──click──► Supabase detail panel
     ├─ cluster layer (circle + count label)
     ├─ wells layer  (circle, color by oil/gas; filter/highlight by operator)
     └─ click well → panel: well + operator (name, P-5 status, address, officers)
```

Why PMTiles for the dots even though data is in PostGIS:
- The point set is a static monthly dump, so precomputed static tiles are the
  simplest and fastest path and need no tile server. PostGIS `ST_AsMVT` is now a
  viable fallback (data is already in PostGIS), but it adds an RPC/edge function
  and cold starts for no benefit on static data. Keep PMTiles; revisit only if
  the map needs live server-side filtering beyond what tile attributes allow.

## Data model in Supabase

Loaded from the Parquet outputs (one-time per monthly refresh):

| Table | From | Key | Use |
|---|---|---|---|
| `wells` | `well_summary` + `well_location` | `api_number` | map detail, geometry (PostGIS point), filters |
| `well_operator` | derived | `api_number` | operator_number + source per well |
| `operators` | `orf850` A-records | `operator_number` | P-5 profile (name, status, address) |
| `operator_officers` | `orf850` K-records | `operator_number` | officers/principals |
| `permits` | `daf804` | `api_number` | permit history |
| segment tables (28) | `dbf900` | `api_number` | deep well detail (formations, plugging, casing…) on demand |

Indexes: `api_number` on everything; `operator_number` on operators/officers;
PostGIS GiST index on `wells.geom` for spatial queries. A `well_operator_detail`
view (or materialized table) mirrors the DuckDB one for the click payload.

## Tiles: baked attributes

Keep tiles small; only what the map needs for render/filter/highlight:
`api_number`, `oil_gas`, `admin_district`, `is_plugged`, `total_depth`, and
**`operator_number`** (new — enables client-side "highlight this operator's
wells" and operator filtering via Mapbox expressions). Everything richer
(operator name, officers, formations, plugging history) is fetched from Supabase
on click, not carried in tiles.

## Click-a-well detail panel (the key feature)

On well click, query Supabase by `api_number` and render:

- **Well**: API, lease name, well number, district/county, type (oil/gas),
  total depth, plugged status + plug date, completion date, location.
- **Operator** (from `well_operator_detail`): operator name, P-5 status
  (Active/Inactive/Delinquent), mailing address, last P-5 date, and the
  **officer list** (from `operator_officers`). Show the source badge
  (permit / H-15 / plugging-name).
- **Graceful gap**: ~70% of wells resolve an operator; for the ~30% pre-1976
  wells with none, show "Operator not on file (pre-1976 well)" rather than empty.
- Optionally a "more" section with formation tops and plugging history from the
  segment tables.

## Phases

### Phase 0 — Supabase schema + load (foundational, new)
- Migration in `supabase/migrations/`: create the tables above + PostGIS,
  indexes, `well_operator_detail` view, RLS (public read).
- Loader `scripts/load_supabase.py`: read Parquet, COPY/batch-insert into
  Supabase (Postgres `COPY` for the big tables; wells geometry via
  `ST_SetSRID(ST_MakePoint(lon,lat),4326)`).
- Deliverable: all RRC data queryable in Supabase by `api_number`.

### Phase 1 — Export GeoJSON for tiling
- `scripts/export_wells_geojson.py`: wells with valid coords + the 6 baked
  attributes (incl. `operator_number`), from Supabase or the Parquet directly.
- Deliverable: `wells.geojson`, ~961k features.

### Phase 2 — Build clustered PMTiles
- Install `tippecanoe` (build tool; not present yet).
  ```bash
  tippecanoe -o public/tiles/wells.pmtiles -l wells \
    -Z0 -z14 --cluster-distance=12 \
    --drop-densest-as-needed --extend-zooms-if-still-dropping \
    wells.geojson
  ```
- Deliverable: `public/tiles/wells.pmtiles` (~10-30 MB).

### Phase 3 — Host the tiles
- Serve from `public/tiles/` (Next static serving supports HTTP range requests),
  gitignored, with the build script as source of truth. Supabase Storage is the
  alternative.

### Phase 4 — `/map` page (clustered map)
- Deps: `npm i mapbox-gl pmtiles` + `npm i -D @types/mapbox-gl`.
- Env: `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local` + `.env.example`.
- `src/app/map/page.tsx` (server shell) + `src/components/map/wells-map.tsx`
  (`'use client'`): register `pmtiles://`, add the vector source, cluster layer
  (circle + count), wells layer (circle by oil/gas), fit to Texas.

### Phase 5 — Click detail panel (well + operator + officers)
- On well click, call Supabase via `src/lib/supabase/client.ts`:
  `well_operator_detail` + `operator_officers` + key well fields by `api_number`.
- Render the panel spec above (side panel or popover).

### Phase 6 — Filtering and operator highlight
- Client-side `map.setFilter` on tile attributes: oil/gas, district, plugged,
  and **operator** (by `operator_number`). For "show only operator X", a search
  box resolves a name to a number via Supabase, then filters the tiles.

## Tech / dependencies

| Need | Choice | Status |
|---|---|---|
| Map renderer | `mapbox-gl` | to install |
| Tile reader | `pmtiles` | to install |
| Tile builder | `tippecanoe` | to install (build tool) |
| DB / detail / geometry | Supabase Postgres + PostGIS | wired; needs schema + load |
| Loader | Python (`scripts/load_supabase.py`) | to build |
| Token | `NEXT_PUBLIC_MAPBOX_TOKEN` | to add |

## Risks / open decisions

1. **Mapbox token**: public, URL-restricted, in `.env.local`.
2. **Supabase tier/size**: wells + operators + permits are modest; the 28
   segment tables (~26.5M rows) push storage to the Pro tier. Decide whether to
   load all segments now or just wells + operators + permits first (segments can
   come later, lazily). Recommended: load wells + operators + permits + the
   link views first (everything the map needs), add segment tables in a second
   pass.
3. **Tile hosting**: `public/` (gitignored) vs Supabase Storage. Default `public/`.
4. **tippecanoe install** in this environment (not present); fallback is a small
   Python tiler or PostGIS `ST_AsMVT`.
5. **Operator coverage (~70%)**: panel must handle the no-operator case cleanly.

## Alternative (if needs change)

If the map later needs heavy server-side filtering or live data, swap the tile
source to **PostGIS `ST_AsMVT` via a Supabase RPC/edge function** (optionally
`ST_ClusterDBSCAN` for low-zoom clustering). Same frontend, different source URL.
Now low-cost since the data already lives in PostGIS, but unnecessary for a
static dataset.
