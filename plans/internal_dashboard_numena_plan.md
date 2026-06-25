# Plan: Internal Metrics Dashboard (standalone, local)

## Context

We built a metrics HTTP API (`/api/internal/metrics/*`, token-gated; `/api/stats/platform`, public)
and a first-party analytics pipeline. Now we want an **internal dashboard** that consumes those
endpoints and displays the data usefully. It should be **separate from the numena app**, live in a
new `dashboard/` directory **in this same repo**, run **locally only** for now, and stay **as simple
as possible** — this plan is a self-contained build guide.

### Decisions locked
- **Placement:** standalone Next.js app in `dashboard/` (same repo). It needs a server tier anyway —
  the `INTERNAL_METRICS_SECRET` must stay server-side — so Next.js (not a Vite SPA).
- **Run target:** local only, on its own port (`:3001`; the numena app uses `:3000`).
- **Auth:** shared password via **HTTP Basic Auth** in `proxy.ts` (Vercel Authentication is not an
  option for a locally-run app — it only gates Vercel-hosted deployments).
- **UI/charts:** **shadcn/ui + Recharts** (both already used in the main app).
- **Data fetching:** **server components** fetch the metrics API with the bearer and render; charts
  are small `'use client'` Recharts components. Date range lives in the URL (`?from=&to=`). No
  proxy route, no react-query — fewest moving parts.

### How the secret stays safe
Browser → dashboard server component (holds `INTERNAL_METRICS_SECRET`) → numena API. The token is a
non-`NEXT_PUBLIC` env var read only in server code, so it never ships to the browser.

---

## Step 1 — Isolate `dashboard/` from the root app's tooling

The root is a single flat Next app (no workspaces). Next only compiles `src/`, but the root
`tsconfig` and jest globs would otherwise sweep `dashboard/`. Edits to the **root** repo:

- `tsconfig.json` → add `"dashboard"` to `exclude`.
- `.vercelignore` → add `dashboard/` (keeps it out of the main app's deploy bundle).
- `jest.config.js` **and** `jest.integration.config.js` → add `testPathIgnorePatterns: ['<rootDir>/dashboard']`.
- `.gitignore` → add `dashboard/node_modules`, `dashboard/.next`, `dashboard/.env*.local`.

## Step 2 — Scaffold the app

```bash
# from repo root
npx create-next-app@latest dashboard \
  --typescript --tailwind --app --src-dir --eslint --use-npm --import-alias "@/*"
cd dashboard
npx shadcn@latest init -d            # accept defaults; creates dashboard/components.json
npx shadcn@latest add card button table badge select separator tabs
npm i recharts
```

`dashboard/.env.local`:
```
NUMENA_API_BASE_URL=http://localhost:3000
INTERNAL_METRICS_SECRET=<same value as the main app's .env.local>
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=<pick a password>
```
Run it on a separate port: `next dev -p 3001` (set in `dashboard/package.json` `"dev"` script).

## Step 3 — Basic-Auth gate — `dashboard/src/proxy.ts`

Next.js 16 renamed the `middleware.ts` convention to **`proxy.ts`** (function `middleware` →
`proxy`). The main app already uses this — mirror `src/proxy.ts`.

```ts
import { NextResponse, type NextRequest } from 'next/server'

export function proxy(req: NextRequest) {
  const user = process.env.DASHBOARD_USER
  const pass = process.env.DASHBOARD_PASSWORD
  if (!user || !pass) return new NextResponse('Dashboard auth not configured', { status: 500 })

  const expected = 'Basic ' + btoa(`${user}:${pass}`)
  if (req.headers.get('authorization') !== expected) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Numena Metrics"' },
    })
  }
  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
```

## Step 4 — Server-side API client — `dashboard/src/lib/metrics.ts`

Server-only (reads the secret). Holds typed getters for each endpoint (shapes are known — see the
endpoint→widget map below). Core helper:

```ts
import 'server-only'
const BASE = process.env.NUMENA_API_BASE_URL ?? 'http://localhost:3000'
const SECRET = process.env.INTERNAL_METRICS_SECRET

export async function fetchMetric<T>(path: string, params?: Record<string, string>): Promise<T> {
  if (!SECRET) throw new Error('INTERNAL_METRICS_SECRET not set')
  const url = new URL(path, BASE)
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${SECRET}` }, cache: 'no-store' })
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json() as Promise<T>
}
```
Plus `getOverview`, `getPageViews`, `getVisitors`, `getSources`, `getBehaviorFunnel`, etc. — each a
one-liner over `fetchMetric` with a TS interface matching the documented response shape.

## Step 5 — Layout + date-range control

- `dashboard/src/app/layout.tsx` — sidebar nav (Overview / Traffic / Funnels) + a `<DateRange>`
  control (a `'use client'` shadcn `Select` of presets 7d/30d/90d that does
  `router.push('?from=…&to=…')`). Pages read `searchParams.from/to`, default to last 30d, and pass
  the window to `fetchMetric`.
- A shared `resolveRange(searchParams)` util (mirror of the API's default-30d behavior).

## Step 6 — Pages & the endpoint → widget map

Each page is an `async` server component that fetches and renders. Reusable client charts in
`dashboard/src/components/charts/` (`LineSeries`, `BarSeries`, `FunnelBars`) + a `<KpiCard>`.

**`/` Overview** — one call to `GET /api/internal/metrics/overview?from&to`:
- KPI cards: Live issuers (`issuers.liveIssuers`), Live investors (`investors.liveInvestors`),
  Active offerings (`offerings.activeOfferings`), Total raised (`raised.allTime`), Total investments
  (`investments.total`), Cancellation rate (`investments.cancellationRate`).
- Time series (area/line): `timeseries[]` → investments / signups / raised.
- Funnel mini-cards: `funnels.investment` / `funnels.onboarding` / `funnels.issuer`.
- Logins sparkline: `logins.daily[]`.

**`/traffic`** — Track B (rollup-backed; needs the rollup cron to have run):
- `GET /page-views` → daily page-views line + top-paths table.
- `GET /visitors` → DAU line; WAU/MAU + avg-duration KPI cards; sessions line; bounce-rate line.
- `GET /sources` → traffic sources bar, device breakdown, geo table.
- `GET /behavior-funnel` → view→click→initiated→trade funnel (totals) + per-offering table.

**`/funnels`** (or fold into Overview) — Track A detail:
- `GET /funnels/investment` → CREATED→FUNDED→SETTLED funnel + conversion % + median time-to-X.
- `GET /funnels/onboarding`, `GET /funnels/issuer` → stage bars + drop-off %.
- `GET /investments` + `GET /offerings` → status breakdown bar, mean/median sizes, success/fill rate.

(Full field-level shapes for all 17 endpoints are documented in the API; widgets read those fields directly.)

## Step 7 — Reusable pieces
- `<KpiCard title value delta? format=number|currency|percent>` (shadcn `Card`).
- `<LineSeries data xKey series=[…]>` and `<BarSeries>` (Recharts, `'use client'`).
- `<FunnelBars stages=[{label,value}]>` — horizontal bars with drop-off labels.
- `format.ts` — currency/percent/number/seconds-to-human helpers.

## Step 8 — Populate Track B data before viewing `/traffic`
The behavioral rollups are empty until the rollup runs. Either:
- generate events by browsing the main app, then trigger:
  `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/analytics-rollup`, or
- run `select analytics_refresh_rollups(2);` in the Supabase SQL editor.
Track A pages (`/`, `/funnels`) need no rollup — they read live data.

---

## Verification
1. Main app running on `:3000` (with the migrations applied on Dev, secrets set).
2. `cd dashboard && npm run dev` → open `http://localhost:3001` → browser prompts for Basic-Auth →
   enter `DASHBOARD_USER`/`DASHBOARD_PASSWORD`.
3. Overview renders KPI cards + charts with real numbers (proves the server→API→token path works).
4. Confirm the secret never reaches the browser: DevTools → Network/Sources shows no
   `INTERNAL_METRICS_SECRET` and no direct calls to `:3000` from the page (all fetching is server-side).
5. Trigger the rollup, reload `/traffic` → page-views/visitors/sources/behavior-funnel populate.
6. Root app untouched: `npm run build` and `npm test` at the repo root still pass (dashboard excluded).

## Out of scope / follow-ups
- Vercel deploy + stronger auth (Vercel Authentication or Supabase magic-link) — revisit if it goes
  beyond local.
- Auto-refresh/polling (add `@tanstack/react-query` + a thin BFF proxy only if you later want live
  updates without full-page reloads).
- Saved views, CSV export, alerting.

## Dashboard file tree
```
dashboard/
├── package.json  tsconfig.json  next.config.ts  components.json  .env.local
├── src/
│   ├── proxy.ts                      # Basic-Auth gate (Next 16 "proxy", formerly middleware)
│   ├── lib/{metrics.ts,format.ts,range.ts}
│   ├── components/{kpi-card.tsx, date-range.tsx, charts/*}
│   └── app/
│       ├── layout.tsx                # nav + date range
│       ├── page.tsx                  # Overview
│       ├── traffic/page.tsx
│       └── funnels/page.tsx
```
