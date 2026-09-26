# ProbablyThisWay

ProbablyThisWay is a map-first hiking decision-support prototype. It renders searched OpenStreetMap trails or authoritative Massachusetts DCR route alternatives on 3D terrain, attaches a typed hiking-state snapshot, and evaluates every valid route through a server-side OpenRouter integration or a clearly labeled deterministic development baseline.

## Status

The prototype currently supports search-first internet trail discovery and attributed evaluated sessions through OpenStreetMap Nominatim, a Cesium terrain view, optional reviewed DCR alternatives, session startup and automatic active-session refresh with optional live weather/daylight, visible current/stale/prototype condition status, typed state updates, cumulative threshold-driven re-evaluation, stale-update rejection, a cursor-based live decision feed, per-route suitability scores, hard-constraint filtering, deterministic recommendation highlighting, an animated start-to-finish route preview with synchronized decision replay and pause/replay controls, explicit map zoom/pan/frame controls, a persistent auditable decision explanation with normalized inputs, every score, policy checks, exclusion reasons, factors, and final rationale; a collapsible playback instrument, explicit no-route outcomes, evidence-backed explanations, and responsive recommendation-focused camera behavior. The moving pointer is an animated guide, not live GPS. Route geometry is a reviewed snapshot of Massachusetts DCR data with source IDs and timestamps. It is not a live closure feed or a navigation guarantee. Product, architecture, API, data, and UI specifications are maintained in [`docs/`](docs/).

## Core Principles

- Use authoritative geospatial data for production trails and routes.
- Keep final route selection deterministic and auditable.
- Use the versioned deterministic question catalog and evidence copy; no LLM is required.
- Do not present recommendations as safety guarantees.
- Do not include simulated-condition controls.

## Repository

- `apps/web` — React/Vite client and Cesium map.
- `apps/api` — Fastify API, session orchestration, and route evaluation.
- `packages/contracts` — shared Zod schemas and TypeScript types.
- `docs` — living product and technical documentation.

## Development

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

The web client runs at `http://localhost:5173` and the API at `http://localhost:3001`.

The API automatically loads an untracked repository-root `.env` during local startup; existing process/deployment variables take precedence. The app runs without provider credentials in local development. Submitted trail searches use public OpenStreetMap Nominatim geocoding and, for point/area matches, a bounded OSM map extract for nearby paths. Requests are serialized, duplicate queries are cached, and attribution stays visible. TRAIL_SEARCH_API_BASE_URL selects the Nominatim-compatible endpoint and TRAIL_MAP_API_BASE_URL selects the map-extract endpoint; neither requires an API key for the default local setup. Without a Cesium token, the map uses the public ArcGIS World Elevation terrain service and displays its provider credits. A scoped token upgrades the source to Cesium World Terrain. Without an OpenRouter key, route scores use the visibly labeled deterministic baseline. To enable hosted evaluation, create a server-side key at `https://openrouter.ai/settings/keys` and set `OPENROUTER_API_KEY`. `OPENROUTER_MODEL` defaults to `openrouter/auto`; pin an OpenRouter model ID for predictable cost and behavior. `OPENROUTER_API_URL`, `OPENROUTER_SITE_URL`, and `OPENROUTER_APP_NAME` are optional provider settings. Set `STATE_ADAPTER_TOKEN` to a secret of at least 32 characters to protect state updates. Set `DATABASE_URL` to use durable PostgreSQL session/event storage, then run `npm run db:migrate -w @probably-this-way/api`; the command is version-tracked and safe to repeat. Both variables are mandatory when `NODE_ENV=production`; local development and tests use the in-memory store when `DATABASE_URL` is absent. Never commit credentials.

Browser-only Vite settings can be placed in `apps/web/.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_CESIUM_ION_ACCESS_TOKEN=
```

See [`docs/environment-config-reference.md`](docs/environment-config-reference.md) for the complete reference.

## Verification

```bash
npm run quality
npm test
npm run check
npm run build
npm run test:e2e
```

`npm run quality` enforces ESLint and Prettier. `npm test` builds shared contracts and runs the API tests. `npm run check` type-checks all workspaces. `npm run build` produces the API and web production builds. `npm run test:e2e` runs the desktop and mobile Chromium product flows. GitHub Actions also verifies PostgreSQL migrations/retention and smoke-tests the production container topology for pull requests targeting `main` and pushes to `main`.

## Production containers

The repository includes pinned API and web images plus `compose.yaml`. Copy the required values from `.env.example` into an untracked `.env`, then run `docker compose config --quiet`, `docker compose build`, and `docker compose up -d`. Migrations complete before the API starts, and the web service waits for API readiness. See [`docs/deployment.md`](docs/deployment.md) for secrets, verification, update, rollback, and provider handoff guidance.

## Live Weather

The weather provider is specifically Open-Meteo. The default `WEATHER_API_BASE_URL=https://api.open-meteo.com/v1/forecast` is the free/non-commercial Forecast API and requires no key, so leave `WEATHER_API_KEY` empty. For paid/commercial use, obtain an Open-Meteo Customer API key from `https://dashboard.open-meteo.com/`, set `WEATHER_API_BASE_URL=https://customer-api.open-meteo.com/v1/forecast`, and put that customer key in the server-only `WEATHER_API_KEY`. Do not use an OpenWeatherMap or WeatherAPI key. The provider initializes new sessions with current temperature, wind, precipitation probability, day/night status, and UTC sunset data. Responses are validated and time out after four seconds. Active sessions refresh automatically every five minutes by default; set WEATHER_REFRESH_INTERVAL_MS to an integer of at least 60000 to change the interval. Each provider snapshot records observation and server receipt times, and threshold-crossing refreshes publish through the existing decision feed. Conditions become stale immediately after a refresh failure or once the observation exceeds WEATHER_FRESHNESS_MAX_AGE_MS (30 minutes by default); the HUD keeps the last valid values visible with an explicit warning. Development and tests fall back to the visibly labeled prototype-static snapshot; production requires the provider and fails closed when it is unavailable. Live weather includes Open-Meteo/CC BY 4.0 attribution in the HUD.

## Trail Data

The search form can discover direct line-mapped trails and named places such as hills or parks; place results include a bounded set of nearby mapped paths. Internet results depend on OpenStreetMap coverage and naming, so not every physical trail is guaranteed to appear. After selection, a user may start the mapped trail. A LineString is evaluated as one candidate; a MultiLineString contributes up to the eight longest visibly named branches. Search-derived access, exposure, condition, and elevation remain explicitly unknown and must be checked against current official guidance.

The three supported evaluated summit corridors come from the Massachusetts DCR Roads and Trails public feature layer. Run `npm run data:refresh:dcr` to re-query the reviewed source segment IDs and regenerate the checked-in WGS84 snapshot. Generation rejects missing, non-legal, malformed, or materially disconnected segments. The DCR snapshot is not a live closure feed; always check current agency notices and posted signs.
