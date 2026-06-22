# Mapbox GL JS Documentation (local mirror)

Offline markdown copy of the Mapbox GL JS **guides** and **API reference**,
scraped from https://docs.mapbox.com/mapbox-gl-js/. Regenerate with:

```bash
python3 scripts/scrape_mapbox_docs.py
```

## API reference

- [api.md](api.md) — overview
- [api/map.md](api/map.md) — the `Map` class (constructor, options, methods, events)
- [api/markers.md](api/markers.md) — markers, popups, and UI controls
- [api/sources.md](api/sources.md) — GeoJSON, vector, raster, image sources
- [api/properties.md](api/properties.md) — layer paint/layout properties
- [api/geography.md](api/geography.md) — LngLat, bounds, points, geometry
- [api/handlers.md](api/handlers.md) — interaction handlers (scroll, drag, zoom)
- [api/events.md](api/events.md) — map and feature events

## Guides

- [guides.md](guides.md) — guides overview
- [guides/get-started.md](guides/get-started.md) — quickstart (+ CDN / npm / scaffold)
- [guides/add-your-data.md](guides/add-your-data.md) — adding markers and layers
- [guides/styles.md](guides/styles.md) — setting styles, working with layers
- [guides/user-interactions.md](guides/user-interactions.md) — gestures, Interactions API
- [guides/globe.md](guides/globe.md), [guides/projections.md](guides/projections.md) — globe view and projections
- [guides/indoor.md](guides/indoor.md), [guides/migrate.md](guides/migrate.md),
  [guides/pricing.md](guides/pricing.md),
  [guides/security-and-testing.md](guides/security-and-testing.md),
  [guides/transpiling.md](guides/transpiling.md)

Each file begins with a `<!-- Source: ... -->` comment linking back to the
canonical page.
