# Tech Stack

## Implemented Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React | Application UI and state composition |
| Language | TypeScript | Typed frontend and service code |
| 3D map | CesiumJS with Vite static asset copying | Terrain, trails, route overlays, camera controls, and optional World Terrain |
| Backend | Node.js | API and orchestration layer |
| Decision engine | Jev | Structured route suitability evaluation |
| Database | PostgreSQL 17 | Durable session, evaluation, event, migration, and retention persistence |

## Supporting Choices

- Workspace/package manager: npm workspaces.
- Web build tooling: Vite.
- HTTP framework: Fastify.
- Validation library: Zod, shared through the contracts workspace.
- Weather integration: Open-Meteo Forecast API through a server-side, provider-shaped adapter.
- Database query layer: `node-postgres` with parameterized SQL and explicit transactions; no ORM.
- Test framework: Node test runner through `tsx`, Playwright desktop/mobile Chromium flows, TypeScript checks, and production builds.
- CI: GitHub Actions on Ubuntu with Node.js 22 and locked npm installs.
- Logging: Fastify/Pino structured JSON with configurable severity.
- API traffic guard: `@fastify/rate-limit` 11.2.0 with bounded environment configuration.
- Deployment packaging: Docker images for Fastify and Nginx plus a provider-neutral Compose topology with PostgreSQL 17.
- Hosting and metrics: provider-neutral; the operator selects products while preserving documented probes, logs, backups, and alerts.
- Question/explanation strategy: versioned deterministic question catalog and deterministic evidence copy; no LLM dependency in this release.

## Selection Principles

- Prefer stable, well-supported libraries.
- Keep route generation and policy deterministic.
- Treat the approved deterministic Jev question catalog and structured explanation fields as the release contract.
- Isolate external map, weather, trail, and Jev integrations behind adapters.

## Authoritative Trail Data

Massachusetts DCR Roads and Trails is the trail-geometry source. The repository transforms reviewed ArcGIS feature IDs into a checked-in WGS84 snapshot, while the official DCR trail map supplies published distance, ascent, and duration values. Cesium World Terrain remains optional for rendered terrain.
