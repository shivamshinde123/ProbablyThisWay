# ProbablyThisWay

ProbablyThisWay is a map-first hiking decision-support prototype. It renders preview route alternatives on 3D terrain, attaches a typed hiking-state snapshot, and evaluates every valid route through a server-side Jev integration or a clearly labeled deterministic development baseline.

## Status

The prototype currently supports a Cesium terrain view, three typed route alternatives, session startup with optional live weather/daylight, typed state updates, cumulative threshold-driven re-evaluation, stale-update rejection, a cursor-based live decision feed, per-route suitability scores, deterministic recommendation highlighting, evidence-backed explanations, and responsive recommendation-focused camera behavior. Route geometry and conditions are prototype data and are not valid for navigation. Product, architecture, API, data, and UI specifications are maintained in [`docs/`](docs/).

## Core Principles

- Use authoritative geospatial data for production trails and routes.
- Keep final route selection deterministic and auditable.
- Treat LLM assistance as optional and outside the critical decision loop.
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

The app runs without provider credentials in local development. Without a Cesium token, the map uses an ellipsoid preview. Without a Jev key, route scores use the visibly labeled deterministic baseline. To exercise hosted Jev evaluation, set `JEV_API_KEY` in the API process environment; `JEV_API_URL` is optional. Set `STATE_ADAPTER_TOKEN` to a secret of at least 32 characters to protect state updates. Set `DATABASE_URL` to use durable PostgreSQL session/event storage, then run `npm run db:migrate -w @probably-this-way/api`. Both variables are mandatory when `NODE_ENV=production`; local development and tests use the in-memory store when `DATABASE_URL` is absent. Never commit credentials.

Browser-only Vite settings can be placed in `apps/web/.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_CESIUM_ION_ACCESS_TOKEN=
```

See [`docs/environment-config-reference.md`](docs/environment-config-reference.md) for the complete reference.

## Verification

```bash
npm test
npm run check
npm run build
```

`npm test` builds shared contracts and runs the API tests. `npm run check` type-checks all workspaces. `npm run build` produces the API and web production builds.

## Live Weather

Set `WEATHER_API_BASE_URL=https://api.open-meteo.com/v1/forecast` in the API environment; paid endpoints may also use server-only `WEATHER_API_KEY` to initialize new sessions with current temperature, wind, precipitation probability, day/night status, and UTC sunset data. Responses are validated and time out after four seconds. Development and tests fall back to the visibly labeled prototype-static snapshot; production requires the provider and fails closed when it is unavailable. Live weather includes Open-Meteo/CC BY 4.0 attribution in the HUD.
