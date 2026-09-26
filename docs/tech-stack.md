# Tech Stack

## Selected in the Project Plan

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React | Application UI and state composition |
| Language | TypeScript | Typed frontend and service code |
| 3D map | CesiumJS | Terrain, trails, route overlays, and camera controls |
| Backend | Node.js | API and orchestration layer |
| Decision engine | Jev | Structured route suitability evaluation |
| Database | PostgreSQL with PostGIS | Relational and geospatial persistence |

## Supporting Choices

- Workspace/package manager: npm workspaces.
- Web build tooling: Vite.
- HTTP framework: Fastify.
- Validation library: Zod, shared through the contracts workspace.
- ORM/query layer: TBD; it must preserve PostGIS support.
- Test frameworks: TBD; TypeScript checks and production builds are the initial quality gates.
- Hosting, CI/CD, logging, and metrics: TBD.
- LLM provider/model for question selection and explanations: TBD.

## Selection Principles

- Prefer stable, well-supported libraries.
- Keep route generation and policy deterministic.
- Treat the approved deterministic Jev question catalog as the required baseline. Use an LLM only as an optional enhancement for bounded question selection, optional question generation, and explanations.
- Isolate external map, weather, trail, Jev, and LLM integrations behind adapters.
