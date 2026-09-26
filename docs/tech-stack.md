# Tech Stack

## Selected in the Project Plan

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React | Application UI and state composition |
| Language | TypeScript | Typed frontend and service code |
| 3D map | CesiumJS with Vite static asset copying | Terrain, trails, route overlays, camera controls, and optional World Terrain |
| Backend | Node.js | API and orchestration layer |
| Decision engine | Jev | Structured route suitability evaluation |
| Database | PostgreSQL with PostGIS | Relational and geospatial persistence |

## Supporting Choices

- Workspace/package manager: npm workspaces.
- Web build tooling: Vite.
- HTTP framework: Fastify.
- Validation library: Zod, shared through the contracts workspace.
- Weather integration: Open-Meteo Forecast API through a server-side, provider-shaped adapter.
- Database query layer: `node-postgres` with parameterized SQL and explicit transactions; no ORM.
- Test framework: Node test runner through `tsx`, plus TypeScript checks and production builds.
- CI: GitHub Actions on Ubuntu with Node.js 22 and locked npm installs.
- Hosting, deployment, logging, and metrics: TBD.
- LLM provider/model for question selection and explanations: TBD.

## Selection Principles

- Prefer stable, well-supported libraries.
- Keep route generation and policy deterministic.
- Treat the approved deterministic Jev question catalog as the required baseline. Use an LLM only as an optional enhancement for bounded question selection, optional question generation, and explanations.
- Isolate external map, weather, trail, Jev, and LLM integrations behind adapters.

## Authoritative Trail Data

Massachusetts DCR Roads and Trails is the trail-geometry source. The repository transforms reviewed ArcGIS feature IDs into a checked-in WGS84 snapshot, while the official DCR trail map supplies published distance, ascent, and duration values. Cesium World Terrain remains optional for rendered terrain.
