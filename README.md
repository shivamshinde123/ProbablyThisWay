# ProbablyThisWay

ProbablyThisWay is a map-first hiking decision-support prototype. It renders preview route alternatives on 3D terrain, attaches a typed hiking-state snapshot, and evaluates every valid route through a server-side Jev integration or a clearly labeled deterministic development baseline.

## Status

The prototype currently supports a Cesium terrain view, three typed route alternatives, session startup, static hiking state, per-route suitability scores, deterministic recommendation highlighting, evidence-backed explanations, and responsive recommendation-focused camera behavior. Route geometry and conditions are prototype data and are not valid for navigation. Product, architecture, API, data, and UI specifications are maintained in [`docs/`](docs/).

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

The app runs without provider credentials. Without a Cesium token, the map uses an ellipsoid preview. Without a Jev key, route scores use the visibly labeled deterministic baseline. To exercise hosted Jev evaluation, set `JEV_API_KEY` in the API process environment; `JEV_API_URL` is optional. Never commit credentials.

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
