# File and Folder Structure

The repository is an npm-workspaces monorepo. This map reflects the implemented release baseline; generated build output and installed dependencies are intentionally omitted.

```text
/
|-- .github/workflows/ci.yml          # Pull-request and main verification
|-- apps/
|   |-- api/
|   |   |-- migrations/               # Ordered immutable PostgreSQL migrations
|   |   |-- src/
|   |   |   |-- generated/            # Reviewed DCR route snapshot
|   |   |   |-- app.ts                # Fastify composition and HTTP routes
|   |   |   |-- server.ts             # API process entry point
|   |   |   |-- session-state.ts      # State transition orchestration
|   |   |   |-- session-store.ts      # PostgreSQL/in-memory persistence boundary
|   |   |   |-- evaluation.ts         # OpenRouter adapter and deterministic baseline
|   |   |   |-- policy.ts             # Hard constraints and recommendation policy
|   |   |   |-- weather-adapter.ts    # Open-Meteo normalization
|   |   |   |-- weather-refresh.ts    # Periodic refresh scheduler
|   |   |   `-- *.test.ts             # Co-located unit/contract/integration tests
|   |   `-- Dockerfile
|   `-- web/
|       |-- public/                    # Static browser assets
|       |-- src/
|       |   |-- components/            # Terrain, HUD, recommendation, event feed
|       |   |-- App.tsx                # Browser orchestration
|       |   |-- main.tsx               # Browser entry point
|       |   `-- styles.css             # Responsive visual system
|       |-- nginx.conf                 # Static serving and same-origin API proxy
|       `-- Dockerfile
|-- packages/contracts/src/index.ts   # Shared Zod schemas and TypeScript types
|-- scripts/import-dcr-trails.mjs     # Reproducible DCR snapshot generator
|-- tests/e2e/core-flow.spec.ts       # Desktop/mobile browser flows
|-- docs/                             # Required product and engineering records
|-- compose.yaml                      # PostgreSQL, migration, API, and web topology
|-- eslint.config.js                  # Source correctness rules
|-- .gitattributes                    # Cross-platform LF text policy
|-- .prettierignore                   # Generated/build formatting exclusions
|-- playwright.config.ts              # Browser-test orchestration
|-- .env.example                      # Safe configuration names/defaults
|-- package.json                      # Workspace commands and pinned quality tools
|-- package-lock.json                 # Reproducible dependency graph
`-- tsconfig.base.json                # Shared strict TypeScript options
```

## Ownership Rules

- `packages/contracts` owns wire schemas and shared public types; both applications depend on it.
- `apps/api` owns provider credentials, persistence, evaluation orchestration, and policy.
- `apps/web` owns presentation and browser polling; it never receives server secrets.
- Provider payloads are validated and normalized at API adapter boundaries.
- Unit and contract tests stay beside source; cross-process browser tests stay under `tests/e2e`.
- `apps/api/src/generated/wachusett-routes.ts` changes only through the import command plus review of source provenance.
- Build output belongs in ignored `dist` or `output` directories and is never edited by hand.

## Session Lifecycle Migration

- apps/api/migrations/003_session_lifecycle.sql — permits persisted active and ended session states.
